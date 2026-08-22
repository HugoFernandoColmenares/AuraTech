import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth/auth';
import { AlertService } from '@core/services/Utils/alert.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  loading = signal(false);

  registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const { email, password } = this.registerForm.getRawValue();

    try {
      const response = await this.authService.signUp({ email, password });

      if (response.error) {
        this.alertService.error('Registration failed', response.error);
        return;
      }

      if (response.pendingEmailConfirmation) {
        this.registerForm.reset();
        this.alertService.success(
          'Account created',
          'Check your email to confirm your account, then sign in from the login page.'
        );
        return;
      }

      if (response.user && response.session) {
        this.alertService.success('Welcome!', 'Your account is ready. Redirecting to the dashboard…');
        await this.router.navigateByUrl('/layout/home', { replaceUrl: true });
        return;
      }

      this.registerForm.reset();
      this.alertService.success(
        'Registration complete',
        'You can now sign in with your new credentials.'
      );
    } catch {
      this.alertService.error('Unexpected error', 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
