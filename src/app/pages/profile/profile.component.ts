import { Component, inject, signal, ChangeDetectionStrategy, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth/auth';
import { ProfileService } from '@core/services/auth/profile';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { AVATAR_MAX_INPUT_BYTES } from '@core/auxiliar/avatar-image.util';
import { IUserDto } from '@core/interfaces/user.interface';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private alertService = inject(AlertService);
  private loadingService = inject(LoadingService);
  private appStartup = inject(AppStartupService);
  readonly rolePermissions = inject(RolePermissionService);

  user = this.authService.currentUser;
  profile = this.profileService.profile;

  isEditing = signal<boolean>(false);
  isSaving = signal(false);
  avatarPreview = signal<string | null>(null);
  private pendingAvatarFile = signal<File | null>(null);

  editUsername = signal<string>('');
  editFirstName = signal<string>('');
  editLastName = signal<string>('');

  displayProfile = computed(() => this.profile() ?? this.user());

  displayAvatar = computed(() => this.avatarPreview() ?? this.displayProfile()?.avatarUrl ?? '');

  fullName = computed(() => {
    const prof = this.displayProfile();
    if (!prof) return 'Guest User';
    return `${prof.firstName} ${prof.lastName}`.trim() || prof.userName || 'Guest User';
  });

  roleLabel = computed(() => {
    const roles = this.displayProfile()?.roles ?? [];
    return roles.map(r => r.name).join(', ') || 'User';
  });

  async ngOnInit(): Promise<void> {
    await this.appStartup.whenReady();
    const current = this.user();
    if (current && !this.profile()) {
      await this.profileService.ensureProfile(current.id);
    }
    const prof = this.displayProfile();
    if (prof) {
      this.syncFormFromProfile(prof);
    }
  }

  private syncFormFromProfile(prof: IUserDto): void {
    this.editUsername.set(prof.userName || '');
    this.editFirstName.set(prof.firstName || '');
    this.editLastName.set(prof.lastName || '');
  }

  toggleEdit() {
    const prof = this.displayProfile();
    if (prof) {
      this.syncFormFromProfile(prof);
    }
    this.avatarPreview.set(null);
    this.pendingAvatarFile.set(null);
    this.isEditing.set(!this.isEditing());
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      this.alertService.error('File too large', 'Please choose an image under 5 MB.');
      return;
    }

    this.pendingAvatarFile.set(file);
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  async saveProfile() {
    const prof = this.displayProfile();
    const currentUser = this.user();
    if (!prof || !currentUser) return;

    this.isSaving.set(true);
    this.loadingService.show('Saving profile…');
    try {
      const pendingFile = this.pendingAvatarFile();
      if (pendingFile) {
        await this.profileService.uploadAvatar(currentUser.id, pendingFile);
        this.pendingAvatarFile.set(null);
        this.avatarPreview.set(null);
      }

      await this.profileService.updateProfile({
        id: currentUser.id,
        userName: this.editUsername().trim(),
        firstName: this.editFirstName().trim(),
        lastName: this.editLastName().trim(),
      });

      this.isEditing.set(false);
      this.alertService.success('Success', 'Profile updated successfully.');
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      this.alertService.error('Error', message);
    } finally {
      this.isSaving.set(false);
      this.loadingService.hide();
    }
  }
}
