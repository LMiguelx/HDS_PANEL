import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { AuthService } from '../../core/auth/auth';

const RUC_KEY = 'hds.ruc';

/**
 * Login — una sola tarjeta (sin franjas ni bordes internos) sobre el
 * degradado de marca (`--brand-gradient`, definido junto al resto de
 * tokens en _tokens.scss). La imagen usa una ruta relativa a propósito:
 * esta app también se empaqueta como .exe con Electron y se carga con
 * `file://` — una ruta que empieza con "/" no resuelve ahí.
 */
@Component({
  selector: 'app-login',
  imports: [UiButton, UiField],
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="hispanica.png" alt="Hispánica Distribuciones" />

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
        padding: var(--sp-6);
        background: var(--brand-gradient);
        box-sizing: border-box;
      }
      .login-card {
        width: 100%;
        max-width: 420px;
        box-sizing: border-box;
        background: var(--bg);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: var(--sp-10) var(--sp-8) var(--sp-8);
        display: grid;
        gap: var(--sp-6);
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
      .login-logo {
        display: block;
        width: 150px;
        max-width: 60%;
        height: auto;
        margin: 0 auto;
      }
      form {
        display: grid;
        gap: 18px;
      }
      form > ui-field,
      .login-pass-field {
        width: 100%;
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
        padding: 10px 14px;
        background: var(--accent-wash);
        color: var(--accent-ink);
        border-radius: var(--radius-sm);
        font-size: 13px;
        line-height: 1.45;
      }
      .login-submit {
        width: 100%;
        margin-top: 4px;
        border-radius: var(--radius-sm);
      }
      /* ui-field es compartido por todo el panel (radio 0 a propósito); acá
         se redondea solo dentro de esta tarjeta, sin tocar el componente. */
      :host ::ng-deep .login-card .ui-input {
        border-radius: var(--radius-sm);
      }

      @media (max-width: 480px) {
        .login-card {
          padding: var(--sp-8) var(--sp-5) var(--sp-6);
          border-radius: var(--radius-md);
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
