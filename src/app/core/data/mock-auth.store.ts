import { IUserDto } from '@core/interfaces/user.interface';
import { INITIAL_USERS, MockUserRecord } from '@core/data/mock-users.data';

const MOCK_USERS_KEY = 'auratech_users';
const MOCK_SESSION_KEY = 'auratech_current_user';

function hydrateUserDates(record: MockUserRecord): MockUserRecord {
  return {
    ...record,
    user: {
      ...record.user,
      createdAt: new Date(record.user.createdAt),
      updatedAt: new Date(record.user.updatedAt),
      roles: record.user.roles.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    },
  };
}

/** Centralized mock auth persistence (localStorage). */
export class MockAuthStore {
  static getUsersList(): MockUserRecord[] {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      return (JSON.parse(raw) as MockUserRecord[]).map(hydrateUserDates);
    } catch {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
  }

  static saveUsersList(users: MockUserRecord[]): void {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }

  static getSessionUser(): IUserDto | null {
    const raw = localStorage.getItem(MOCK_SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as IUserDto;
    } catch {
      return null;
    }
  }

  static setSessionUser(user: IUserDto): void {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
  }

  static clearSessionUser(): void {
    localStorage.removeItem(MOCK_SESSION_KEY);
  }
}
