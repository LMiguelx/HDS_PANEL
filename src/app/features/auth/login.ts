import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { AuthService } from '../../core/auth/auth';

const RUC_KEY = 'hds.ruc';

@Component({
  selector: 'app-login',
  imports: [UiButton, UiField],
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-head">
          <div class="login-brand">HDSAPP</div>
          <div class="login-sub">Panel de control</div>
        </div>

        <form (submit)="submit($event)">
          <ui-field
            label="RUC de la empresa"
            placeholder="11 dígitos"
            [(value)]="ruc"
            [error]="rucError()"
          />
          <ui-field label="Usuario" [(value)]="username" [error]="userError()" />

          <div class="login-pass">
            <ui-field
              label="Contraseña"
              [type]="hidePass() ? 'password' : 'text'"
              [(value)]="password"
              [error]="passError()"
            />
            <button uiButton variant="ghost" size="sm" type="button" (click)="hidePass.set(!hidePass())">
              {{ hidePass() ? 'Mostrar contraseña' : 'Ocultar contraseña' }}
            </button>
          </div>

          @if (error()) {
            <p class="login-error">{{ error() }}</p>
          }

          <button uiButton variant="primary" type="submit" class="login-submit" [loading]="loading()">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        font-family: var(--font-sans);
      }
      .login-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: var(--sp-4);
        background: var(--bg);
        color: var(--ink);
      }
      .login-card {
        width: 100%;
        max-width: 380px;
        border: 2px solid var(--divider);
        background: var(--bg);
        padding: 28px 24px 24px;
      }
      .login-head {
        border-bottom: var(--border-rule);
        padding-bottom: 14px;
        margin-bottom: 22px;
      }
      .login-brand {
        font-weight: 800;
        font-size: 20px;
        letter-spacing: -0.01em;
      }
      .login-sub {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-top: 2px;
      }
      form {
        display: grid;
        gap: 16px;
      }
      .login-pass {
        display: grid;
        gap: 4px;
        justify-items: start;
      }
      .login-error {
        margin: 0;
        padding: 10px 12px;
        background: var(--accent-wash);
        color: var(--accent-ink);
        font-size: 13px;
        line-height: 1.45;
      }
      .login-submit {
        width: 100%;
        margin-top: 4px;
      }
    `,
  ],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly ruc = signal(localStorage.getItem(RUC_KEY) ?? '');
  readonly username = signal('');
  readonly password = signal('');

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hidePass = signal(true);
  /** Los errores por campo solo aparecen después del primer intento. */
  private submitted = signal(false);

  readonly rucError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.ruc().trim()) return 'Escribe el RUC de la empresa.';
    return /^\d{11}$/.test(this.ruc().trim()) ? '' : 'El RUC debe tener 11 dígitos.';
  });
  readonly userError = computed(() =>
    this.submitted() && !this.username().trim() ? 'Escribe tu usuario.' : '',
  );
  readonly passError = computed(() =>
    this.submitted() && !this.password() ? 'Escribe tu contraseña.' : '',
  );

  submit(ev: Event) {
    ev.preventDefault();
    this.submitted.set(true);
    if (this.loading() || this.rucError() || this.userError() || this.passError()) return;

    this.loading.set(true);
    this.error.set(null);
    const ruc = this.ruc().trim();
    localStorage.setItem(RUC_KEY, ruc); // el RUC es fijo por empresa: se recuerda

    this.auth.login(ruc, this.username().trim(), this.password()).subscribe({
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
