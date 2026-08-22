import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IUserDto, IAuthDto, IAuthResponse } from '../../interfaces/user.interface';
import { AuthApiService } from '../api/auth-api.service';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { shouldUseMockAuth } from '@core/auxiliar/auth-offline.util';
import { clearAccessToken } from '@core/auxiliar/auth-token.util';
import { withTimeout } from '@core/auxiliar/promise-timeout.util';
import { MockAuthStore } from '../../data/mock-auth.store';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly env = inject(EnvConfig);
  private readonly health = inject(HealthService);

  private readonly _user = signal<IUserDto | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _authReady = signal(false);
  private readonly initPromise: Promise<void>;

  readonly currentUser = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly authReady = this._authReady.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());

  constructor() {
    this.initPromise = this.initializeAuthState();
  }

  whenReady(): Promise<void> {
    return this.initPromise;
  }

  private useMockAuth(): boolean {
    return shouldUseMockAuth(this.env, this.health);
  }

  private async initializeAuthState(): Promise<void> {
    try {
      await this.health.whenReady();

      if (this.useMockAuth()) {
        await withTimeout(this.restoreMockSession(), 4_000, 'Mock auth session');
        return;
      }

      await withTimeout(this.restoreLiveSession(), 4_000, 'Supabase auth session');
    } finally {
      this._authReady.set(true);
    }
  }

  private async restoreMockSession(): Promise<void> {
    const response = await this.authApi.restoreSession();
    if (!response?.user) return;

    this._user.set(response.user);
    this._accessToken.set(response.session?.access_token ?? AuthApiService.getStoredAccessToken());
  }

  private async restoreLiveSession(): Promise<void> {
    const response = await this.authApi.restoreSession();
    if (!response?.user) {
      this._user.set(null);
      this._accessToken.set(null);
      return;
    }

    this._user.set(response.user);
    this._accessToken.set(response.session?.access_token ?? AuthApiService.getStoredAccessToken());
  }

  private applySession(response: IAuthResponse): void {
    if (response.user && response.session) {
      this._user.set(response.user);
      this._accessToken.set(response.session.access_token);
      AuthApiService.storeAccessToken(response.session.access_token);

      if (this.useMockAuth()) {
        MockAuthStore.setSessionUser(response.user);
      }
    }
  }

  async signUp(credentials: IAuthDto): Promise<IAuthResponse> {
    const response = await this.authApi.register(credentials);
    if (!response.error && response.user) {
      this.applySession(response);
    }
    return response;
  }

  async signIn(credentials: IAuthDto): Promise<IAuthResponse> {
    const response = await this.authApi.login(credentials);
    if (!response.error && response.user) {
      this.applySession(response);
    }
    return response;
  }

  async signOut(): Promise<void> {
    if (this.useMockAuth()) {
      MockAuthStore.clearSessionUser();
    } else {
      await this.authApi.logout();
    }
    clearAccessToken();
    this._user.set(null);
    this._accessToken.set(null);
    await this.router.navigate(['/auth/login']);
  }

  async resetPassword(_email: string): Promise<IAuthResponse> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return { user: null, session: null, error: null };
  }

  async updatePassword(_newPassword: string): Promise<IAuthResponse> {
    const currentUserObj = this._user();
    if (!currentUserObj) {
      return { user: null, session: null, error: 'No active session.' };
    }
    return { user: currentUserObj, session: { access_token: this._accessToken() ?? '' }, error: null };
  }

  /** Reload profile and roles from Supabase (e.g. after admin role changes). */
  async refreshCurrentUser(): Promise<void> {
    const response = await this.authApi.restoreSession();
    if (response?.user) {
      this._user.set(response.user);
      if (response.session?.access_token) {
        this._accessToken.set(response.session.access_token);
      }
    }
  }
}
