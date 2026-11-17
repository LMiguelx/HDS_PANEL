import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { AuthService } from '../../core/auth/auth';

const RUC_KEY = 'hds.ruc';

/**
 * Login — pantalla partida: panel izquierdo con el degradado de marca
 * (`--brand-gradient`, definido junto al resto de tokens en _tokens.scss)
 * y el logo; panel derecho oscuro (fijo, no depende del tema claro/oscuro
 * del resto del panel — es una pantalla de marca) con el formulario.
 * La imagen usa ruta relativa a propósito: esta app también se empaqueta
 * como .exe con Electron y se carga con `file://`, donde una ruta que
 * empieza con "/" no resuelve.
 */
@Component({
  selector: 'app-login',
  imports: [UiButton, UiField],
  template: `
    <div class="login-wrap">
      <div class="login-split">
        <div class="login-brand-panel">
          <div class="login-logo-frame">
            <img class="login-logo" src="hispanica.png" alt="Hispánica Distribuciones" />
          </div>
          <h1 class="login-tagline">Panel de control</h1>
          <p class="login-tagline-sub">Pedidos, clientes y reparto en un solo lugar.</p>
        </div>

        <div class="login-form-panel">
          <div class="login-form-inner">
            <h2 class="login-form-title">Inicia sesión</h2>

            <form (submit)="submit($event)">
              <ui-field
                label="RUC de la empresa"
                icon="apartment"
                placeholder="11 dígitos"
                [(value)]="ruc"
                [error]="rucError()"
              />
              <ui-field label="Usuario" icon="person" [(value)]="username" [error]="userError()" />

              <ui-field
                label="Contraseña"
                icon="lock"
                [hasSuffix]="true"
                [type]="hidePass() ? 'password' : 'text'"
                [(value)]="password"
                [error]="passError()"
              >
                <button
                  fieldSuffix
                  type="button"
                  class="login-eye-btn"
                  [attr.aria-label]="hidePass() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                  (click)="hidePass.set(!hidePass())"
                >
                  <span class="material-icons" aria-hidden="true">{{
                    hidePass() ? 'visibility' : 'visibility_off'
                  }}</span>
                </button>
              </ui-field>

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
      .login-split {
        width: 100%;
        max-width: 960px;
        min-height: 560px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 1fr 1.1fr;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: var(--shadow-card);
        animation: login-split-in 0.42s var(--ease-standard);
      }
      @keyframes login-split-in {
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
        .login-split {
          animation: none;
        }
      }

      /* — Panel izquierdo: degradado de marca — */
      .login-brand-panel {
        background: var(--brand-gradient);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: var(--sp-8);
        text-align: center;
      }
      .login-logo-frame {
        background: #fff;
        border-radius: 20px;
        padding: 20px 26px;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
      }
      .login-logo {
        display: block;
        width: 140px;
        height: auto;
      }
      .login-tagline {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
        color: #fff;
      }
      .login-tagline-sub {
        margin: 0;
        max-width: 260px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.82);
      }

      /* — Panel derecho: fijo oscuro (pantalla de marca, independiente del
         tema claro/oscuro del resto del panel) — redefine los tokens de
         superficie/tinta localmente; se heredan en ui-field y ui-button
         aunque vivan en otro componente. — */
      .login-form-panel {
        --bg: #1a1918;
        --surface-sunk: #201e1d;
        --ink: #f3f2f2;
        --ink-muted: #a09b98;
        --divider: rgba(243, 242, 242, 0.26);
        --hairline: rgba(243, 242, 242, 0.14);
        --faint: rgba(243, 242, 242, 0.06);
        --accent-wash: rgba(236, 48, 19, 0.16);
        --accent-ink: #ff9783;
        --on-accent: #ffffff;
        background: var(--bg);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--sp-8);
      }
      .login-form-inner {
        width: 100%;
        max-width: 360px;
      }
      .login-form-title {
        margin: 0 0 var(--sp-6);
        font-size: 24px;
        font-weight: 800;
        color: var(--ink);
      }
      form {
        display: grid;
        gap: 18px;
      }
      .login-eye-btn {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: 0;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .login-eye-btn:hover {
        color: var(--ink);
      }
      .login-eye-btn .material-icons {
        font-size: 20px;
      }
      .login-error {
        margin: 0;
        padding: 10px 14px;
        background: var(--accent-wash);
        color: var(--accent-ink);
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.45;
      }
      .login-submit {
        width: 100%;
        margin-top: 4px;
        min-height: 48px;
        border-radius: 10px;
        color: var(--on-accent);
      }

      /* ui-field es compartido por todo el panel (radio 0, foco de 1px a
         propósito ahí); esta pantalla de marca pide inputs de 48px, radio
         10px y un foco con glow suave — se aplica solo dentro de esta
         tarjeta, sin tocar el componente para el resto del sistema. */
      .login-form-panel {
        --touch-min: 48px;
      }
      :host ::ng-deep .login-form-panel .ui-input {
        border-radius: 10px;
        border-color: var(--divider);
      }
      :host ::ng-deep .login-form-panel .ui-input:focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 4px var(--accent-wash);
      }

      @media (max-width: 820px) {
        .login-split {
          grid-template-columns: 1fr;
          min-height: 0;
        }
        .login-brand-panel {
          padding: var(--sp-6) var(--sp-6) var(--sp-5);
          gap: 14px;
        }
        .login-logo-frame {
          padding: 14px 18px;
        }
        .login-logo {
          width: 110px;
        }
        .login-tagline {
          font-size: 18px;
        }
      }
      @media (max-width: 480px) {
        .login-wrap {
          padding: var(--sp-4);
        }
        .login-form-panel {
          padding: var(--sp-6) var(--sp-5);
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
