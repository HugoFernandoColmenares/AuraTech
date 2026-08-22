import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { AdminUsersApiService, AdminUserRow } from '@core/services/api/admin-users-api.service';
import { confirmAndRemoveBatch } from '@core/auxiliar/batch-record-delete.util';
import { AlertService } from '@core/services/Utils/alert.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { IRoleDto } from '@core/interfaces/user.interface';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { PERMISSIONS_BY_ROLE } from '@core/constants/permissions.const';
import { ROLE_NORMALIZED } from '@core/constants/roles.const';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanelComponent implements OnInit {
  private readonly adminApi = inject(AdminUsersApiService);
  private readonly alertService = inject(AlertService);
  private readonly loadingService = inject(LoadingService);
  readonly permissions = inject(RolePermissionService);

  users = signal<AdminUserRow[]>([]);
  roles = signal<IRoleDto[]>([]);
  selectedUser = signal<AdminUserRow | null>(null);
  isEditing = signal(false);

  editFirstName = signal('');
  editLastName = signal('');
  editUserName = signal('');
  editRoleId = signal('');
  tableSelectionReset = signal(0);

  isLoading = this.loadingService.isLoading;

  columns: TableColumn[] = [
    { key: 'email', label: 'Email' },
    { key: 'userName', label: 'Username' },
    { key: 'fullName', label: 'Name' },
    { key: 'roleName', label: 'Role', type: 'badge' },
    { key: 'actions', label: 'Actions', type: 'action' },
  ];

  tableData = computed(() =>
    this.users().map(u => ({
      ...u,
      fullName: `${u.firstName} ${u.lastName}`.trim() || '—',
    }))
  );

  rolePermissionSummary = [
    { role: 'User', permissions: [...PERMISSIONS_BY_ROLE[ROLE_NORMALIZED.USER]].join(', ') },
    { role: 'Manager', permissions: [...PERMISSIONS_BY_ROLE[ROLE_NORMALIZED.MANAGER]].join(', ') },
    { role: 'Administrator', permissions: [...PERMISSIONS_BY_ROLE[ROLE_NORMALIZED.ADMIN]].join(', ') },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loadingService.show('Loading users…');
    try {
      const [users, roles] = await Promise.all([
        this.adminApi.listUsers(),
        this.adminApi.listRoles(),
      ]);
      this.users.set(users);
      this.roles.set(roles);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load admin data.';
      this.alertService.error('Error', message);
    } finally {
      this.loadingService.hide();
    }
  }

  handleTableAction(event: { action: string; row: AdminUserRow & { fullName?: string } }): void {
    const user = this.users().find(u => u.id === event.row.id);
    if (!user) return;

    if (event.action === 'edit' || event.action === 'view') {
      this.openEditor(user);
    } else if (event.action === 'delete') {
      void this.confirmDelete(user);
    }
  }

  handleBulkTableAction(event: { action: string; rows: unknown[] }): void {
    if (event.action !== 'bulkDelete') return;
    const rows = (event.rows as AdminUserRow[]).map(row => this.users().find(u => u.id === row.id)).filter(
      (user): user is AdminUserRow => !!user
    );
    void this.confirmBulkDelete(rows);
  }

  openEditor(user: AdminUserRow): void {
    this.selectedUser.set(user);
    this.editFirstName.set(user.firstName);
    this.editLastName.set(user.lastName);
    this.editUserName.set(user.userName);
    this.editRoleId.set(user.roleId || user.roles[0]?.id || '');
    this.isEditing.set(true);
  }

  closeEditor(): void {
    this.isEditing.set(false);
    this.selectedUser.set(null);
  }

  async saveUser(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;

    this.loadingService.show('Saving user…');
    try {
      await this.adminApi.updateUserProfile(user.id, {
        firstName: this.editFirstName(),
        lastName: this.editLastName(),
        userName: this.editUserName(),
      });

      if (this.editRoleId() && this.editRoleId() !== user.roleId) {
        await this.adminApi.setUserRole(user.id, this.editRoleId());
      }

      this.alertService.success('Saved', 'User updated successfully.');
      this.closeEditor();
      await this.loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save user.';
      this.alertService.error('Error', message);
    } finally {
      this.loadingService.hide();
    }
  }

  async confirmDelete(user: AdminUserRow): Promise<void> {
    const result = await this.alertService.confirm(
      'Delete user?',
      `This will permanently remove ${user.email}.`
    );
    if (!result.isConfirmed) return;

    this.loadingService.show('Deleting user…');
    try {
      await this.adminApi.deleteUser(user.id);
      this.alertService.success('Deleted', 'User removed.');
      this.tableSelectionReset.update(n => n + 1);
      await this.loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not delete user.';
      this.alertService.error('Error', message);
    } finally {
      this.loadingService.hide();
    }
  }

  async confirmBulkDelete(users: AdminUserRow[]): Promise<void> {
    const removed = await confirmAndRemoveBatch({
      rows: users,
      alertService: this.alertService,
      confirmTitle: 'Delete selected users?',
      confirmMessage: count =>
        `This will permanently remove ${count} user account${count === 1 ? '' : 's'}.`,
      remove: id => this.adminApi.deleteUser(id),
      successMessage: (deletedRows: any[]) => `${deletedRows.length} user${deletedRows.length === 1 ? '' : 's'} removed: ${deletedRows.map(u => u.email).join(', ')}.`,
    });

    if (removed) {
      this.tableSelectionReset.update(n => n + 1);
      await this.loadData();
    }
  }
}
