import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { AuthService } from '../../core/auth/auth';

const RUC_KEY = 'hds.ruc';

/**
 * Login — logo y franja de color de la empresa (public/brand/logo.jpg),
 * acento rojo institucional reservado para los controles interactivos (ver
 * _tokens.scss: "una sola familia; rojo institucional"). Al entrar navega a
 * /splash en vez de directo a /dashboard.
 */
@Component({
  selector: 'app-login',
  imports: [UiButton, UiField],
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-brand-bar" aria-hidden="true"></div>
        <div class="login-head">
          <img class="login-logo" src="/brand/logo.jpg" alt="Hispánica Distribuciones" />
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

          <div class="login-pass-field">
            <ui-field
              label="Contraseña"
              [type]="hidePass() ? 'password' : 'text'"
              [(value)]="password"
              [error]="passError()"
            />
            <button type="button" class="login-pass-toggle" (click)="hidePass.set(!hidePass())">
              {{ hidePass() ? 'Mostrar contraseña' : 'Ocultar contraseña' }}
            </button>
          </div>

          @if (error()) {
            <p class="login-error">{{ error() }}</p>
          }

          <button
            uiButton
            variant="primary"
            type="submit"
            class="login-submit"
            [loading]="loading()"
          >
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
        padding: var(--sp-5);
        background: var(--bg);
        color: var(--ink);
      }
      .login-card {
        width: 100%;
        max-width: 400px;
        border: 2px solid var(--divider);
        background: var(--bg);
        overflow: hidden;
        animation: login-card-in 0.42s var(--ease-standard);
      }
      @keyframes login-card-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .login-card {
          animation: none;
        }
      }
      .login-brand-bar {
        height: 6px;
        background: linear-gradient(90deg, #c9166e, #e8832b, #e3d23f, #2fae5c, #1aa6a6, #4a3a9e);
      }
      .login-head {
        display: grid;
        justify-items: center;
        gap: 10px;
        padding: var(--sp-8) var(--sp-6) var(--sp-5);
        border-bottom: var(--border-rule);
      }
      .login-logo {
        width: 180px;
        max-width: 72%;
        height: auto;
      }
      .login-sub {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      form {
        display: grid;
        gap: 18px;
        padding: var(--sp-6);
      }
      .login-pass-field {
        display: grid;
        gap: 6px;
        justify-items: end;
      }
      .login-pass-toggle {
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
        background: transparent;
        border: 0;
        padding: 4px 2px;
        cursor: pointer;
        min-height: 32px;
      }
      .login-pass-toggle:hover {
        text-decoration: underline;
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

      @media (max-width: 480px) {
        .login-head {
          padding: var(--sp-6) var(--sp-4) var(--sp-4);
        }
        form {
          padding: var(--sp-4);
        }
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
        void this.router.navigateByUrl('/splash');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.detail ?? 'No se pudo iniciar sesión. Verifica tus datos.');
      },
    });
  }
}
