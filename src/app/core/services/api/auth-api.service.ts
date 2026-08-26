import { Injectable, inject } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { EnvConfig } from '../../config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { shouldUseMockAuth, shouldUseSupabaseAuth } from '@core/auxiliar/auth-offline.util';
import {
  clearAccessToken,
  getStoredAccessToken,
  storeAccessToken,
} from '@core/auxiliar/auth-token.util';
import { mapSupabaseProfileToUser } from '@core/auxiliar/supabase-profile.util';
import { IUserDto, IRoleDto, IAuthDto, IAuthResponse, IAuthSession } from '../../interfaces/user.interface';
import { DateUtils } from '@core/auxiliar/date.utils';
import { DEFAULT_ROLES } from '../../data/mock-users.data';
import { MockAuthStore } from '../../data/mock-auth.store';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { SUPABASE_TABLES } from '@core/constants';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private env = inject(EnvConfig);
  private health = inject(HealthService);
  private supabase = inject(SupabaseService);
  private authListenerRegistered = false;

  static getStoredAccessToken(): string | null {
    return getStoredAccessToken();
  }

  static storeAccessToken(token: string): void {
    storeAccessToken(token);
  }

  static clearAccessToken(): void {
    clearAccessToken();
  }

  async login(data: IAuthDto): Promise<IAuthResponse> {
    if (shouldUseMockAuth(this.env, this.health)) {
      return this.loginWithMock(data);
    }
    if (shouldUseSupabaseAuth(this.env, this.health)) {
      return this.loginWithSupabase(data);
    }
    return { user: null, session: null, error: 'Supabase is not configured.' };
  }

  async register(data: IAuthDto & { firstName?: string; lastName?: string }): Promise<IAuthResponse> {
    if (shouldUseMockAuth(this.env, this.health)) {
      return this.registerWithMock(data);
    }
    if (shouldUseSupabaseAuth(this.env, this.health)) {
      return this.registerWithSupabase(data);
    }
    return { user: null, session: null, error: 'Supabase is not configured.' };
  }

  async logout(): Promise<void> {
    if (shouldUseMockAuth(this.env, this.health)) return;

    const client = this.supabase.getClient();
    if (client) {
      await client.auth.signOut();
    }
  }

  async restoreSession(): Promise<IAuthResponse | null> {
    if (shouldUseMockAuth(this.env, this.health)) {
      const token = getStoredAccessToken();
      if (!token) return null;
      const user = MockAuthStore.getSessionUser();
      if (!user) return null;
      return {
        user: this.hydrateUser(user),
        session: { access_token: token, token_type: 'bearer' },
        error: null,
      };
    }

    if (shouldUseSupabaseAuth(this.env, this.health)) {
      return this.restoreSupabaseSession();
    }

    return null;
  }

  private ensureSupabaseAuthListener(): void {
    if (this.authListenerRegistered) return;
    const client = this.supabase.getClient();
    if (!client) return;

    this.authListenerRegistered = true;
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        storeAccessToken(session.access_token);
      } else if (_event === 'SIGNED_OUT') {
        clearAccessToken();
      }
    });
  }

  private async restoreSupabaseSession(): Promise<IAuthResponse | null> {
    const client = this.supabase.getClient();
    if (!client) return null;

    this.ensureSupabaseAuthListener();

    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      clearAccessToken();
      return null;
    }

    const email = data.session.user.email;
    if (!email) {
      clearAccessToken();
      return null;
    }

    const user = await this.fetchSupabaseProfile(data.session.user.id, email);
    if (!user) {
      clearAccessToken();
      return null;
    }

    storeAccessToken(data.session.access_token);
    return {
      user: this.hydrateUser(user),
      session: this.mapSupabaseSession(data.session),
      error: null,
    };
  }

  private async loginWithSupabase(credentials: IAuthDto): Promise<IAuthResponse> {
    const client = this.supabase.getClient();
    if (!client) {
      return { user: null, session: null, error: 'Supabase is not configured.' };
    }

    this.ensureSupabaseAuthListener();

    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    if (!data.session || !data.user.email) {
      return { user: null, session: null, error: 'Invalid auth response.' };
    }

    const user = await this.fetchSupabaseProfile(data.user.id, data.user.email);
    if (!user) {
      return { user: null, session: null, error: 'Could not load user profile.' };
    }

    storeAccessToken(data.session.access_token);
    return {
      user: this.hydrateUser(user),
      session: this.mapSupabaseSession(data.session),
      error: null,
    };
  }

  private async registerWithSupabase(
    credentials: IAuthDto & { firstName?: string; lastName?: string }
  ): Promise<IAuthResponse> {
    const client = this.supabase.getClient();
    if (!client) {
      return { user: null, session: null, error: 'Supabase is not configured.' };
    }

    this.ensureSupabaseAuthListener();

    const { data, error } = await client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    if (!data.user?.email) {
      return { user: null, session: null, error: 'Registration failed.' };
    }

    if (credentials.firstName || credentials.lastName) {
      await client
        .from(SUPABASE_TABLES.profiles.table)
        .update({
          first_name: credentials.firstName ?? '',
          last_name: credentials.lastName ?? '',
        })
        .eq('id', data.user.id);
    }

    if (!data.session) {
      return {
        user: null,
        session: null,
        error: null,
        pendingEmailConfirmation: true,
      };
    }

    const user = await this.fetchSupabaseProfile(data.user.id, data.user.email);
    if (!user) {
      return { user: null, session: null, error: 'Account created but profile could not be loaded.' };
    }

    storeAccessToken(data.session.access_token);
    return {
      user: this.hydrateUser(user),
      session: this.mapSupabaseSession(data.session),
      error: null,
    };
  }

  private async fetchSupabaseProfile(userId: string, email: string): Promise<IUserDto | null> {
    const client = this.supabase.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from(SUPABASE_TABLES.profiles.table)
      .select('*, user_roles ( role_id, roles (*) )')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapSupabaseProfileToUser(data as Record<string, unknown>, email);
  }

  private mapSupabaseSession(session: Session): IAuthSession {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      token_type: session.token_type ?? 'bearer',
    };
  }

  private hydrateUser(user: IUserDto): IUserDto {
    return {
      ...user,
      createdAt: DateUtils.parseDate(user.createdAt) ?? DateUtils.now(),
      updatedAt: DateUtils.parseDate(user.updatedAt) ?? DateUtils.now(),
      roles: (user.roles ?? []).map((r: IRoleDto) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    };
  }

  private loginWithMock(credentials: IAuthDto): Promise<IAuthResponse> {
    return new Promise(resolve => {
      setTimeout(() => {
        const users = MockAuthStore.getUsersList();
        const matched = users.find(
          u =>
            u.email.toLowerCase() === credentials.email.toLowerCase() &&
            u.password === credentials.password
        );

        if (!matched) {
          resolve({ user: null, session: null, error: 'Invalid email or password.' });
          return;
        }

        const token = 'mock-jwt-token';
        storeAccessToken(token);
        MockAuthStore.setSessionUser(matched.user);
        resolve({
          user: matched.user,
          session: { access_token: token, token_type: 'bearer' },
          error: null,
        });
      }, 300);
    });
  }

  private registerWithMock(
    credentials: IAuthDto & { firstName?: string; lastName?: string }
  ): Promise<IAuthResponse> {
    return new Promise(resolve => {
      setTimeout(() => {
        const users = MockAuthStore.getUsersList();
        if (users.some(u => u.email.toLowerCase() === credentials.email.toLowerCase())) {
          resolve({ user: null, session: null, error: 'User already exists.' });
          return;
        }

        const userName = credentials.email.split('@')[0];
        const newUser: IUserDto = {
          id: 'user-id-' + Math.random().toString(36).slice(2, 11),
          firstName: credentials.firstName ?? userName,
          lastName: credentials.lastName ?? '',
          userName,
          email: credentials.email,
          isEmailVerified: false,
          isPhoneVerified: false,
          avatarUrl: '',
          normalizedName: userName.toUpperCase(),
          normalizedEmail: credentials.email.toUpperCase(),
          createdAt: DateUtils.now(),
          updatedAt: DateUtils.now(),
          roles: [DEFAULT_ROLES.find(r => r.normalizedName === 'USER') || DEFAULT_ROLES[2]],
        };

        users.push({ email: credentials.email, password: credentials.password, user: newUser });
        MockAuthStore.saveUsersList(users);

        const token = 'mock-jwt-token';
        storeAccessToken(token);
        MockAuthStore.setSessionUser(newUser);
        resolve({
          user: newUser,
          session: { access_token: token, token_type: 'bearer' },
          error: null,
        });
      }, 300);
    });
  }
}
