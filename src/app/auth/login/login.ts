import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth/auth';
import { LoadingService } from '@core/services/Utils/loading.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loadingService = inject(LoadingService);

  // Signals for state management
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  passwordVisible = signal(false);
  rememberMe = signal(
    localStorage.getItem('rememberedEmail') !== null && localStorage.getItem('rememberedPassword') !== null
  );

  loginForm = this.fb.nonNullable.group({
    email: [localStorage.getItem('rememberedEmail') || '', [Validators.required, Validators.email]],
    password: [localStorage.getItem('rememberedPassword') || '', [Validators.required, Validators.minLength(6)]],
    remember: [this.rememberMe()]
  });

  togglePasswordVisibility() {
    this.passwordVisible.update(v => !v);
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password, remember } = this.loginForm.getRawValue();
    let redirecting = false;

    try {
      const response = await this.authService.signIn({ email, password });

      if (response.error) {
        this.errorMessage.set(response.error);
        return;
      }

      if (remember) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberedPassword', password);
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberedPassword');
      }

      redirecting = true;
      this.loadingService.show();
      const navigated = await this.router.navigateByUrl('/layout/home', { replaceUrl: true });
      if (!navigated) {
        this.loadingService.hide();
        redirecting = false;
        this.errorMessage.set('Could not open the dashboard. Please try again.');
      }
    } catch (error: unknown) {
      console.error('[LoginComponent] Login error:', error);
      this.errorMessage.set('An unexpected error occurred. Please try again.');
      this.loadingService.hide();
    } finally {
      if (!redirecting) {
        this.loading.set(false);
      }
    }
  }
}
