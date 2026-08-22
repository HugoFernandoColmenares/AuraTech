import { Injectable, inject } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { shouldUseMockAuth, shouldUseSupabaseAuth } from '@core/auxiliar/auth-offline.util';
import { IUserDto, IRoleDto } from '@core/interfaces/user.interface';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { SUPABASE_TABLES } from '@core/constants/supabase-tables.const';
import { mapSupabaseProfileToUser } from '@core/auxiliar/supabase-profile.util';
import { MockAuthStore } from '@core/data/mock-auth.store';
import { DEFAULT_ROLES } from '@core/data/mock-users.data';
import { DateUtils } from '@core/auxiliar/date.utils';
import { AuthService } from '@core/services/auth/auth';
import { AlertService } from '@core/services/Utils/alert.service';
import {
  ACCESS_DENIED_MESSAGE,
  isForbiddenSupabaseError,
} from '@core/auxiliar/supabase-error.util';

export interface AdminUserRow extends IUserDto {
  roleId: string;
  roleName: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly env = inject(EnvConfig);
  private readonly health = inject(HealthService);
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);

  async listRoles(): Promise<IRoleDto[]> {
    if (shouldUseMockAuth(this.env, this.health)) {
      return DEFAULT_ROLES.map(r => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) }));
    }

    const client = this.supabase.getClient();
    if (!client) return [];

    const { data, error } = await client.from(SUPABASE_TABLES.roles.table).select('*').order('name');
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not load roles.');
    }

    return data.map(row => ({
      id: String(row['id']),
      name: String(row['name']),
      normalizedName: String(row['normalized_name']),
      createdAt: DateUtils.parseDate(row['created_at']) ?? DateUtils.now(),
      updatedAt: DateUtils.parseDate(row['updated_at']) ?? DateUtils.now(),
    }));
  }

  async listUsers(): Promise<AdminUserRow[]> {
    if (shouldUseMockAuth(this.env, this.health)) {
      return MockAuthStore.getUsersList().map(record => {
        const role = record.user.roles[0] ?? DEFAULT_ROLES[2];
        return {
          ...record.user,
          roleId: role.id,
          roleName: role.name,
        };
      });
    }

    if (!shouldUseSupabaseAuth(this.env, this.health)) {
      return [];
    }

    const client = this.supabase.getClient();
    if (!client) return [];

    const { data, error } = await client
      .from(SUPABASE_TABLES.profiles.table)
      .select('*, user_roles ( role_id, roles (*) )')
      .order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not load users.');
    }

    return data.map(row => {
      const email = String(row['email'] ?? '');
      const user = mapSupabaseProfileToUser(row as Record<string, unknown>, email);
      const role = user.roles[0];
      return {
        ...user,
        roleId: role?.id ?? '',
        roleName: role?.name ?? 'User',
      };
    });
  }

  async updateUserProfile(
    userId: string,
    patch: Pick<IUserDto, 'firstName' | 'lastName' | 'userName'>
  ): Promise<void> {
    if (shouldUseMockAuth(this.env, this.health)) {
      const users = MockAuthStore.getUsersList();
      const index = users.findIndex(u => u.user.id === userId);
      if (index === -1) throw new Error('User not found.');

      users[index].user = {
        ...users[index].user,
        ...patch,
        updatedAt: DateUtils.now(),
      };
      MockAuthStore.saveUsersList(users);
      await this.syncSessionIfCurrentUser(userId, users[index].user);
      return;
    }

    const client = this.supabase.getClient();
    if (!client) throw new Error('Supabase is not configured.');

    const { error } = await client
      .from(SUPABASE_TABLES.profiles.table)
      .update({
        first_name: patch.firstName,
        last_name: patch.lastName,
        user_name: patch.userName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw new Error(error.message);
  }

  async setUserRole(userId: string, roleId: string): Promise<void> {
    if (shouldUseMockAuth(this.env, this.health)) {
      const role = DEFAULT_ROLES.find(r => r.id === roleId);
      if (!role) throw new Error('Invalid role.');

      const users = MockAuthStore.getUsersList();
      const index = users.findIndex(u => u.user.id === userId);
      if (index === -1) throw new Error('User not found.');

      users[index].user = {
        ...users[index].user,
        roles: [{ ...role, createdAt: new Date(role.createdAt), updatedAt: new Date(role.updatedAt) }],
        updatedAt: DateUtils.now(),
      };
      MockAuthStore.saveUsersList(users);
      await this.syncSessionIfCurrentUser(userId, users[index].user);
      return;
    }

    const client = this.supabase.getClient();
    if (!client) throw new Error('Supabase is not configured.');

    const { error } = await client.rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role_id: roleId,
    });

    if (error) {
      if (isForbiddenSupabaseError(error)) {
        this.alertService.error('Access denied', ACCESS_DENIED_MESSAGE);
      }
      throw new Error(error.message);
    }

    const current = this.authService.currentUser();
    if (current?.id === userId) {
      await this.authService.refreshCurrentUser();
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const current = this.authService.currentUser();
    if (current?.id === userId) {
      throw new Error('You cannot delete your own account from the admin panel.');
    }

    if (shouldUseMockAuth(this.env, this.health)) {
      const users = MockAuthStore.getUsersList().filter(u => u.user.id !== userId);
      MockAuthStore.saveUsersList(users);
      return;
    }

    const client = this.supabase.getClient();
    if (!client) throw new Error('Supabase is not configured.');

    const { error } = await client.rpc('admin_delete_user', { p_user_id: userId });
    if (error) {
      if (isForbiddenSupabaseError(error)) {
        this.alertService.error('Access denied', ACCESS_DENIED_MESSAGE);
      }
      throw new Error(error.message);
    }
  }

  private async syncSessionIfCurrentUser(userId: string, user: IUserDto): Promise<void> {
    const current = this.authService.currentUser();
    if (current?.id === userId) {
      MockAuthStore.setSessionUser(user);
      await this.authService.refreshCurrentUser();
    }
  }
}
