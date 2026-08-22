import { IUserDto, IRoleDto } from '../interfaces/user.interface';
import { DateUtils } from '@core/auxiliar/date.utils';
import { ROLE_IDS } from '@core/constants/roles.const';

export const DEFAULT_ROLES: IRoleDto[] = [
  {
    id: ROLE_IDS.ADMIN,
    name: 'Administrator',
    normalizedName: 'ADMIN',
    createdAt: DateUtils.now(),
    updatedAt: DateUtils.now(),
  },
  {
    id: ROLE_IDS.MANAGER,
    name: 'Manager',
    normalizedName: 'MANAGER',
    createdAt: DateUtils.now(),
    updatedAt: DateUtils.now(),
  },
  {
    id: ROLE_IDS.USER,
    name: 'User',
    normalizedName: 'USER',
    createdAt: DateUtils.now(),
    updatedAt: DateUtils.now(),
  },
];

export interface MockUserRecord {
  email: string;
  password?: string;
  user: IUserDto;
}

export const INITIAL_USERS: MockUserRecord[] = [
  {
    email: 'admin@auratech.dev',
    password: 'demo123',
    user: {
      id: 'admin-id-123',
      firstName: 'Aura',
      lastName: 'Admin',
      userName: 'admin',
      email: 'admin@auratech.dev',
      isEmailVerified: true,
      isPhoneVerified: false,
      avatarUrl: '',
      normalizedName: 'AURA ADMIN',
      normalizedEmail: 'ADMIN@AURATECH.DEV',
      createdAt: DateUtils.now(),
      updatedAt: DateUtils.now(),
      roles: [DEFAULT_ROLES[0]],
    },
  },
  {
    email: 'user@auratech.dev',
    password: 'demo123',
    user: {
      id: 'user-id-789',
      firstName: 'Aura',
      lastName: 'User',
      userName: 'user',
      email: 'user@auratech.dev',
      isEmailVerified: true,
      isPhoneVerified: false,
      avatarUrl: '',
      normalizedName: 'AURA USER',
      normalizedEmail: 'USER@AURATECH.DEV',
      createdAt: DateUtils.now(),
      updatedAt: DateUtils.now(),
      roles: [DEFAULT_ROLES[2]],
    },
  },
];
