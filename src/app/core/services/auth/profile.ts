import { Injectable, inject, signal } from '@angular/core';
import { IUserDto } from '../../interfaces/user.interface';
import { MockAuthStore } from '../../data/mock-auth.store';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { shouldUseMockAuth, shouldUseSupabaseAuth } from '@core/auxiliar/auth-offline.util';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { SUPABASE_TABLES } from '@core/constants/supabase-tables.const';
import { mapSupabaseProfileToUser } from '@core/auxiliar/supabase-profile.util';
import { AuthService } from './auth';
import { DateUtils } from '@core/auxiliar/date.utils';
import { AvatarStorageService } from './avatar-storage.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly env = inject(EnvConfig);
  private readonly health = inject(HealthService);
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly avatarStorage = inject(AvatarStorageService);

  private readonly _profile = signal<IUserDto | null>(null);
  private loadPromise: Promise<IUserDto | null> | null = null;
  private cachedUserId: string | null = null;

  /** Session-cached profile (loaded once at startup, refreshed after mutations). */
  readonly profile = this._profile.asReadonly();

  async ensureProfile(userId: string): Promise<IUserDto | null> {
    if (this.cachedUserId === userId && this._profile()) {
      return this._profile();
    }

    if (this.loadPromise && this.cachedUserId === userId) {
      return this.loadPromise;
    }

    this.cachedUserId = userId;
    this.loadPromise = this.fetchProfile(userId);
    const profile = await this.loadPromise;
    this._profile.set(profile);
    return profile;
  }

  async ensureCurrentUserProfile(): Promise<IUserDto | null> {
    const user = this.authService.currentUser();
    if (!user) return null;
    return this.ensureProfile(user.id);
  }

  invalidateCache(): void {
    this.loadPromise = null;
    this.cachedUserId = null;
    this._profile.set(null);
  }

  async getProfile(userId: string): Promise<IUserDto | null> {
    return this.ensureProfile(userId);
  }

  async updateProfile(profile: Partial<IUserDto>): Promise<void> {
    if (!profile.id) {
      throw new Error('Profile id is required.');
    }

    if (shouldUseMockAuth(this.env, this.health)) {
      await this.updateMockProfile(profile);
    } else if (shouldUseSupabaseAuth(this.env, this.health)) {
      await this.updateSupabaseProfile(profile);
    } else {
      throw new Error('Profile updates are not available in offline mode.');
    }

    this.invalidateCache();
    await this.ensureProfile(profile.id);
    await this.authService.refreshCurrentUser();
  }

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const avatarUrl = await this.avatarStorage.uploadAvatar(userId, file);

    if (shouldUseMockAuth(this.env, this.health)) {
      await this.updateMockProfile({ id: userId, avatarUrl });
    } else if (shouldUseSupabaseAuth(this.env, this.health)) {
      await this.updateSupabaseProfile({ id: userId, avatarUrl });
    }

    this.invalidateCache();
    await this.ensureProfile(userId);
    await this.authService.refreshCurrentUser();
    return avatarUrl;
  }

  private async fetchProfile(userId: string): Promise<IUserDto | null> {
    if (shouldUseMockAuth(this.env, this.health)) {
      const mock = await this.getMockProfile(userId);
      if (mock && !mock.avatarUrl) {
        const stored = this.avatarStorage.getMockAvatar(userId);
        if (stored) {
          return { ...mock, avatarUrl: stored };
        }
      }
      return mock;
    }

    if (shouldUseSupabaseAuth(this.env, this.health)) {
      return this.getSupabaseProfile(userId);
    }

    return this.authService.currentUser();
  }

  private getMockProfile(userId: string): Promise<IUserDto | null> {
    const users = MockAuthStore.getUsersList();
    const matched = users.find(u => u.user.id === userId);
    return Promise.resolve(matched ? matched.user : null);
  }

  private async getSupabaseProfile(userId: string): Promise<IUserDto | null> {
    const client = this.supabase.getClient();
    if (!client) return null;

    const sessionEmail = this.authService.currentUser()?.email ?? '';

    const { data, error } = await client
      .from(SUPABASE_TABLES.profiles.table)
      .select('*, user_roles ( role_id, roles (*) )')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not load profile.');
    }

    const email = String(data['email'] ?? sessionEmail);
    return mapSupabaseProfileToUser(data as Record<string, unknown>, email);
  }

  private async updateMockProfile(profile: Partial<IUserDto>): Promise<void> {
    const users = MockAuthStore.getUsersList();
    const matchedIndex = users.findIndex(u => u.user.id === profile.id);

    if (matchedIndex === -1) {
      throw new Error('User not found.');
    }

    users[matchedIndex].user = {
      ...users[matchedIndex].user,
      ...profile,
      updatedAt: DateUtils.now(),
    } as IUserDto;
    MockAuthStore.saveUsersList(users);

    const current = this.authService.currentUser();
    if (current?.id === profile.id) {
      MockAuthStore.setSessionUser(users[matchedIndex].user);
    }
  }

  private async updateSupabaseProfile(profile: Partial<IUserDto>): Promise<void> {
    const client = this.supabase.getClient();
    if (!client) {
      throw new Error('Supabase is not configured.');
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (profile.firstName !== undefined) payload['first_name'] = profile.firstName;
    if (profile.lastName !== undefined) payload['last_name'] = profile.lastName;
    if (profile.userName !== undefined) payload['user_name'] = profile.userName;
    if (profile.avatarUrl !== undefined) payload['avatar_url'] = profile.avatarUrl;

    const { error } = await client
      .from(SUPABASE_TABLES.profiles.table)
      .update(payload)
      .eq('id', profile.id!);

    if (error) {
      throw new Error(error.message);
    }
  }
}
