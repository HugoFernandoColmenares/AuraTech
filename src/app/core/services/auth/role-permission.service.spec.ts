import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RolePermissionService } from './role-permission.service';
import { AuthService } from './auth';
import { IUserDto, IRoleDto } from '@core/interfaces/user.interface';
import { ROLE_IDS } from '@core/constants/roles.const';
import { DateUtils } from '@core/auxiliar/date.utils';

function role(name: string, normalizedName: string, id: string): IRoleDto {
  return {
    id,
    name,
    normalizedName,
    createdAt: DateUtils.now(),
    updatedAt: DateUtils.now(),
  };
}

function userWithRoles(roles: IRoleDto[]): IUserDto {
  return {
    id: 'test-user',
    firstName: 'Test',
    lastName: 'User',
    userName: 'test',
    email: 'test@auratech.dev',
    isEmailVerified: true,
    isPhoneVerified: false,
    avatarUrl: '',
    normalizedName: 'TEST',
    normalizedEmail: 'TEST@AURATECH.DEV',
    createdAt: DateUtils.now(),
    updatedAt: DateUtils.now(),
    roles,
  };
}

describe('RolePermissionService', () => {
  let service: RolePermissionService;
  let currentUser = signal<IUserDto | null>(null);

  beforeEach(() => {
    currentUser.set(null);

    TestBed.configureTestingModule({
      providers: [
        RolePermissionService,
        {
          provide: AuthService,
          useValue: { currentUser: currentUser.asReadonly() },
        },
      ],
    });

    service = TestBed.inject(RolePermissionService);
  });

  it('grants read-only permissions to User role', () => {
    currentUser.set(userWithRoles([role('User', 'USER', ROLE_IDS.USER)]));

    expect(service.can('read')).toBeTrue();
    expect(service.can('create')).toBeFalse();
    expect(service.can('edit')).toBeFalse();
    expect(service.can('delete')).toBeFalse();
    expect(service.can('adminPanel')).toBeFalse();
  });

  it('grants create and edit but not delete to Manager', () => {
    currentUser.set(userWithRoles([role('Manager', 'MANAGER', ROLE_IDS.MANAGER)]));

    expect(service.can('create')).toBeTrue();
    expect(service.can('edit')).toBeTrue();
    expect(service.can('delete')).toBeFalse();
    expect(service.can('bulkUpload')).toBeTrue();
    expect(service.can('dataManagement')).toBeFalse();
  });

  it('grants full permissions to Administrator', () => {
    currentUser.set(userWithRoles([role('Administrator', 'ADMIN', ROLE_IDS.ADMIN)]));

    expect(service.can('delete')).toBeTrue();
    expect(service.can('dataManagement')).toBeTrue();
    expect(service.can('adminPanel')).toBeTrue();
  });

  it('uses highest role when multiple roles are present', () => {
    currentUser.set(
      userWithRoles([
        role('User', 'USER', ROLE_IDS.USER),
        role('Administrator', 'ADMIN', ROLE_IDS.ADMIN),
      ])
    );

    expect(service.primaryRole()).toBe('ADMIN');
    expect(service.can('delete')).toBeTrue();
  });

  it('defaults to USER when no roles assigned', () => {
    currentUser.set(userWithRoles([]));

    expect(service.primaryRole()).toBe('USER');
    expect(service.can('create')).toBeFalse();
  });

  it('hasRole checks normalized role names', () => {
    currentUser.set(userWithRoles([role('Manager', 'MANAGER', ROLE_IDS.MANAGER)]));

    expect(service.hasRole('MANAGER')).toBeTrue();
    expect(service.hasRole('ADMIN')).toBeFalse();
  });
});
