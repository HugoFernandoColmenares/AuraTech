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
    email: 'admin@ymi.com',
    password: 'password123',
    user: {
      id: 'admin-id-123',
      firstName: 'YMI',
      lastName: 'Admin',
      userName: 'admin',
      email: 'admin@ymi.com',
      isEmailVerified: true,
      isPhoneVerified: false,
      avatarUrl: '',
      normalizedName: 'YMI ADMIN',
      normalizedEmail: 'ADMIN@YMI.COM',
      createdAt: DateUtils.now(),
      updatedAt: DateUtils.now(),
      roles: [DEFAULT_ROLES[0]],
    },
  },
  {
    email: 'manager@ymi.com',
    password: 'password123',
    user: {
      id: 'manager-id-456',
      firstName: 'YMI',
      lastName: 'Manager',
      userName: 'manager',
      email: 'manager@ymi.com',
      isEmailVerified: true,
      isPhoneVerified: false,
      avatarUrl: '',
      normalizedName: 'YMI MANAGER',
      normalizedEmail: 'MANAGER@YMI.COM',
      createdAt: DateUtils.now(),
      updatedAt: DateUtils.now(),
      roles: [DEFAULT_ROLES[1]],
    },
  },
  {
    email: 'user@ymi.com',
    password: 'password123',
    user: {
      id: 'user-id-789',
      firstName: 'YMI',
      lastName: 'User',
      userName: 'user',
      email: 'user@ymi.com',
      isEmailVerified: true,
      isPhoneVerified: false,
      avatarUrl: '',
      normalizedName: 'YMI USER',
      normalizedEmail: 'USER@YMI.COM',
      createdAt: DateUtils.now(),
      updatedAt: DateUtils.now(),
      roles: [DEFAULT_ROLES[2]],
    },
  },
];
