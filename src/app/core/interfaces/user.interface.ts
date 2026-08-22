export interface IRoleDto {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDto {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatarUrl: string;
  normalizedName: string;
  normalizedEmail: string;
  createdAt: Date;
  updatedAt: Date;
  roles: IRoleDto[];
}

export interface IAuthDto {
  email: string;
  password: string;
}

/** Supabase Auth session token used by supabase-js for authenticated requests. */
export interface IAuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

export interface IAuthResponse {
  user: IUserDto | null;
  session: IAuthSession | null;
  error: string | null;
  /** Account created but Supabase requires email confirmation before sign-in. */
  pendingEmailConfirmation?: boolean;
}
