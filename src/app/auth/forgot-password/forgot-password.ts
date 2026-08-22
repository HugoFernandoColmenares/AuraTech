import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  resetForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { email } = this.resetForm.getRawValue();

    try {
      const response = await this.authService.resetPassword(email);
      
      if (response.error) {
        this.errorMessage.set(response.error);
      } else {
        this.successMessage.set('Reset link sent! Please check your email.');
        this.resetForm.reset();
      }
    } catch (error: any) {
      this.errorMessage.set('An unexpected error occurred. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
