import { toCamelCaseRecord } from '@core/auxiliar/api-payload.util';
import { IRoleDto, IUserDto } from '@core/interfaces/user.interface';
import { DateUtils } from '@core/auxiliar/date.utils';

type UserRoleJoin = {
  roles?: Record<string, unknown> | Record<string, unknown>[] | null;
};

/** Maps a PostgREST profile row (+ nested roles) to {@link IUserDto}. */
export function mapSupabaseProfileToUser(
  profileRow: Record<string, unknown>,
  email: string
): IUserDto {
  const profile = toCamelCaseRecord<Record<string, unknown>>(profileRow);
  const userRoles = (profileRow['user_roles'] as UserRoleJoin[] | undefined) ?? [];

  const roles: IRoleDto[] = userRoles
    .flatMap(join => {
      const raw = join.roles;
      if (!raw) return [];
      return Array.isArray(raw) ? raw : [raw];
    })
    .map(role => {
      const mapped = toCamelCaseRecord<IRoleDto>(role);
      return {
        ...mapped,
        createdAt: DateUtils.parseDate(mapped.createdAt) ?? DateUtils.now(),
        updatedAt: DateUtils.parseDate(mapped.updatedAt) ?? DateUtils.now(),
      };
    });

  const userName = String(profile['userName'] ?? profile['user_name'] ?? email.split('@')[0] ?? '');
  const firstName = String(profile['firstName'] ?? profile['first_name'] ?? '');
  const lastName = String(profile['lastName'] ?? profile['last_name'] ?? '');

  return {
    id: String(profile['id'] ?? ''),
    firstName,
    lastName,
    userName,
    email,
    isEmailVerified: Boolean(profile['isEmailVerified'] ?? profile['is_email_verified']),
    isPhoneVerified: Boolean(profile['isPhoneVerified'] ?? profile['is_phone_verified']),
    avatarUrl: String(profile['avatarUrl'] ?? profile['avatar_url'] ?? ''),
    normalizedName: userName.toUpperCase(),
    normalizedEmail: email.toUpperCase(),
    createdAt: DateUtils.parseDate(profile['createdAt'] ?? profile['created_at']) ?? DateUtils.now(),
    updatedAt: DateUtils.parseDate(profile['updatedAt'] ?? profile['updated_at']) ?? DateUtils.now(),
    roles,
  };
}
