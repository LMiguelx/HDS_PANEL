import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth';

const RUC_KEY = 'hds.ruc';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="login-wrap">
      <mat-card class="login-card">
        <div class="login-head">
          <mat-icon>local_shipping</mat-icon>
          <h1>hdsapp</h1>
          <p class="muted">Panel administrativo</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field class="full" appearance="outline">
            <mat-label>RUC de la empresa</mat-label>
            <input
              matInput
              formControlName="ruc"
              inputmode="numeric"
              maxlength="11"
              autocomplete="organization"
            />
            @if (form.controls.ruc.touched && form.controls.ruc.hasError('pattern')) {
              <mat-error>El RUC debe tener 11 dígitos</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full" appearance="outline">
            <mat-label>Usuario</mat-label>
            <input matInput formControlName="username" autocomplete="username" />
          </mat-form-field>

          <mat-form-field class="full" appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input
              matInput
              [type]="hidePass() ? 'password' : 'text'"
              formControlName="password"
              autocomplete="current-password"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="hidePass.set(!hidePass())"
              aria-label="Mostrar contraseña"
            >
              <mat-icon>{{ hidePass() ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
          </mat-form-field>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          @if (loading()) {
            <mat-progress-bar mode="indeterminate" />
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="loading()">
            Iniciar sesión
          </button>
        </form>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 16px;
        background: var(--mat-sys-surface-container-low);
      }
      .login-card {
        width: 100%;
        max-width: 380px;
        padding: 8px 16px 16px;
      }
      .login-head {
        text-align: center;
        padding: 12px 0 4px;
      }
      .login-head mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: var(--mat-sys-primary);
      }
      .login-head h1 {
        margin: 8px 0 0;
        font-size: 1.4rem;
      }
      .full {
        width: 100%;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .error {
        color: var(--mat-sys-error);
        font-size: 0.85rem;
        margin: 2px 0;
      }
    `,
  ],
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hidePass = signal(true);

  readonly form = this.fb.nonNullable.group({
    ruc: [
      localStorage.getItem(RUC_KEY) ?? '',
      [Validators.required, Validators.pattern(/^\d{11}$/)],
    ],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { ruc, username, password } = this.form.getRawValue();
    localStorage.setItem(RUC_KEY, ruc); // recuerda el RUC (es fijo por empresa)

    this.auth.login(ruc, username, password).subscribe({
      next: (res) => {
        this.auth.handleTokens(res);
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.detail ?? 'No se pudo iniciar sesión. Verifica tus datos.');
      },
    });
  }
}
