import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UserSelfService } from './user-self';
import { UserView } from '../../shared/models/user.models';
import { dateText, timeText } from '../assignments/assignment-format';

/**
 * Autoservicio — GET/PATCH /api/users/me + POST /me/change-password.
 * Cualquier usuario autenticado, sin permiso especial. El límite de 1
 * cambio de contraseña al mes lo valida el backend; el panel lo anticipa
 * con `nextPasswordChangeAt` para no dejar enviar un cambio que va a
 * rechazarse (doc 38, sección 8.4).
 */
@Component({
  selector: 'app-my-profile',
  imports: [UiButton, UiField, UiCard, UiBadge, UiEmpty],
  template: `
    <section class="mp-page">
      <p class="mp-eyebrow-page">Cuenta</p>
      <h1>Mi perfil</h1>

      @if (loading()) {
        <div class="mp-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (loadError()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar tu perfil"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (user(); as u) {
        <ui-card variant="container" class="mp-head-card">
          <div class="mp-head">
            <div class="mp-head-identity">
              <span class="mp-avatar">{{ initials(u) }}</span>
              <div>
                <p class="mp-eyebrow">{{ u.code }} · {{ firstRoleName(u) }}</p>
                <h2 class="mp-fullname">{{ u.fullName }}</h2>
                <div class="mp-role-badges">
                  @for (r of u.roles; track r.roleId; let first = $first) {
                    <ui-badge [tone]="first ? 'accent' : 'neutral'">{{ r.name }}</ui-badge>
                  }
                </div>
              </div>
            </div>

            <div class="mp-head-tiles">
              <div class="mp-tile">
                <span class="mp-tile-label">Usuario</span>
                <span class="mp-tile-value">{{ u.username }}</span>
              </div>
              <div class="mp-tile">
                <span class="mp-tile-label">Sucursal base</span>
                <span class="mp-tile-value">{{ u.homeBranchName ?? '—' }}</span>
              </div>
              <div class="mp-tile">
                <span class="mp-tile-label">Canal de ventas</span>
                <span class="mp-tile-value">{{ u.salesChannelName ?? '—' }}</span>
              </div>
            </div>
          </div>
        </ui-card>

        <div class="mp-grid">
          <ui-card title="Datos personales" subtitle="Información de contacto de tu cuenta">
            <div class="mp-stack">
              <div class="mp-two-col">
                <ui-field label="Nombres" icon="lock" [value]="u.firstName" [disabled]="true" />
                <ui-field
                  label="Apellidos"
                  icon="lock"
                  [value]="u.lastName ?? ''"
                  [disabled]="true"
                />
              </div>
              <p class="mp-lock-hint">Para cambiar tu nombre, pídelo a un administrador.</p>

              <ui-field
                label="Correo"
                icon="mail"
                placeholder="correo@empresa.com"
                [(value)]="email"
              />
              <ui-field
                label="Teléfono"
                icon="call"
                placeholder="+51 9XX XXX XXX"
                [(value)]="phone"
              />
              <ui-field
                label="Foto de perfil (URL)"
                icon="link"
                placeholder="https://"
                [(value)]="profilePhotoUrl"
              />

              @if (profileError()) {
                <p class="mp-error">{{ profileError() }}</p>
              }

              <div class="mp-actions">
                <button
                  uiButton
                  variant="secondary"
                  [disabled]="!profileDirty()"
                  (click)="discardProfile(u)"
                >
                  Descartar
                </button>
                <button
                  uiButton
                  variant="primary"
                  [loading]="savingProfile()"
                  (click)="saveProfile()"
                >
                  Guardar perfil
                </button>
              </div>
            </div>
          </ui-card>

          <ui-card title="Cambiar contraseña" subtitle="Protege el acceso a tu cuenta">
            <div class="mp-stack">
              @if (u.nextPasswordChangeAt) {
                <p class="mp-notice mp-notice-warn">
                  Ya cambiaste tu contraseña este mes. Podrás volver a cambiarla el
                  {{ dateText(u.nextPasswordChangeAt) }} a las
                  {{ timeText(u.nextPasswordChangeAt) }}.
                </p>
              } @else {
                <p class="mp-notice">Solo se permite un cambio de contraseña al mes.</p>
              }
              @if (u.passwordChangedAt) {
                <p class="mp-last-change">Último cambio: {{ dateText(u.passwordChangedAt) }}</p>
              }

              <ui-field
                label="Contraseña actual"
                icon="lock"
                [hasSuffix]="true"
                [type]="hideCurrent() ? 'password' : 'text'"
                [(value)]="currentPassword"
                [disabled]="!!u.nextPasswordChangeAt"
              >
                <button
                  fieldSuffix
                  type="button"
                  class="mp-eye-btn"
                  [attr.aria-label]="hideCurrent() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                  (click)="hideCurrent.set(!hideCurrent())"
                >
                  <span class="material-icons" aria-hidden="true">{{
                    hideCurrent() ? 'visibility' : 'visibility_off'
                  }}</span>
                </button>
              </ui-field>

              <div class="mp-two-col">
                <ui-field
                  label="Contraseña nueva"
                  icon="lock"
                  [hasSuffix]="true"
                  [type]="hideNew() ? 'password' : 'text'"
                  [(value)]="newPassword"
                  [disabled]="!!u.nextPasswordChangeAt"
                >
                  <button
                    fieldSuffix
                    type="button"
                    class="mp-eye-btn"
                    [attr.aria-label]="hideNew() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                    (click)="hideNew.set(!hideNew())"
                  >
                    <span class="material-icons" aria-hidden="true">{{
                      hideNew() ? 'visibility' : 'visibility_off'
                    }}</span>
                  </button>
                </ui-field>
                <ui-field
                  label="Confirmar contraseña"
                  icon="lock"
                  [hasSuffix]="true"
                  [type]="hideConfirm() ? 'password' : 'text'"
                  [(value)]="confirmPassword"
                  [disabled]="!!u.nextPasswordChangeAt"
                >
                  <button
                    fieldSuffix
                    type="button"
                    class="mp-eye-btn"
                    [attr.aria-label]="hideConfirm() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                    (click)="hideConfirm.set(!hideConfirm())"
                  >
                    <span class="material-icons" aria-hidden="true">{{
                      hideConfirm() ? 'visibility' : 'visibility_off'
                    }}</span>
                  </button>
                </ui-field>
              </div>
              <p class="mp-hint">La contraseña nueva debe tener entre 4 y 100 caracteres.</p>

              @if (passwordError()) {
                <p class="mp-error">{{ passwordError() }}</p>
              }

              <div class="mp-actions">
                <button
                  uiButton
                  variant="primary"
                  [disabled]="!!u.nextPasswordChangeAt"
                  [loading]="savingPassword()"
                  (click)="changePassword()"
                >
                  Cambiar contraseña
                </button>
              </div>
            </div>
          </ui-card>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .mp-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .mp-eyebrow-page {
        margin: 0;
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 2px 0 var(--sp-5);
        color: var(--ink);
      }
      .mp-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .mp-head-card {
        margin-bottom: var(--sp-5);
      }
      .mp-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-5);
      }
      .mp-head-identity {
        display: flex;
        align-items: center;
        gap: var(--sp-4);
        min-width: 0;
      }
      .mp-avatar {
        flex: none;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent);
        color: var(--on-accent);
        font-size: 18px;
        font-weight: 800;
      }
      .mp-eyebrow {
        margin: 0 0 2px;
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .mp-fullname {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 var(--sp-2);
        color: var(--ink);
      }
      .mp-role-badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
      }
      .mp-head-tiles {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-3);
      }
      .mp-tile {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--sp-2) var(--sp-4);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-control);
        min-width: 120px;
      }
      .mp-tile-label {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .mp-tile-value {
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--ink);
      }

      .mp-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-5);
        align-items: start;
      }
      .mp-stack {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .mp-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-4);
      }
      .mp-lock-hint {
        margin: calc(var(--sp-4) * -1) 0 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .mp-notice {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
        background: var(--faint);
        border-radius: var(--radius-control);
        padding: var(--sp-3) var(--sp-4);
      }
      .mp-notice-warn {
        color: var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
      }
      .mp-last-change {
        margin: 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .mp-hint {
        margin: 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .mp-error {
        margin: 0;
        color: var(--status-danger);
        font-size: var(--fs-dense);
      }
      .mp-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-3);
        margin-top: auto;
      }
      .mp-eye-btn {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        border: 0;
        background: transparent;
        cursor: pointer;
        color: var(--ink-muted);
      }
      .mp-eye-btn:hover {
        color: var(--ink);
      }

      @media (max-width: 900px) {
        .mp-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .mp-page {
          padding: var(--sp-4);
        }
        .mp-two-col {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MyProfilePage {
  private selfSvc = inject(UserSelfService);

  protected dateText = dateText;
  protected timeText = timeText;

  protected user = signal<UserView | null>(null);
  protected loading = signal(true);
  protected loadError = signal(false);

  protected email = signal('');
  protected phone = signal('');
  protected profilePhotoUrl = signal('');
  protected savingProfile = signal(false);
  protected profileError = signal('');

  protected profileDirty = computed(() => {
    const u = this.user();
    if (!u) return false;
    return (
      this.email() !== (u.email ?? '') ||
      this.phone() !== (u.phone ?? '') ||
      this.profilePhotoUrl() !== ''
    );
  });

  protected currentPassword = signal('');
  protected newPassword = signal('');
  protected confirmPassword = signal('');
  protected savingPassword = signal(false);
  protected passwordError = signal('');
  protected hideCurrent = signal(true);
  protected hideNew = signal(true);
  protected hideConfirm = signal(true);

  constructor() {
    this.load();
  }

  protected initials(u: UserView): string {
    const a = u.firstName?.trim().charAt(0) ?? '';
    const b = u.lastName?.trim().charAt(0) ?? '';
    return (a + b).toUpperCase() || '?';
  }

  protected firstRoleName(u: UserView): string {
    return u.roles[0]?.name ?? '';
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.selfSvc.me().subscribe({
      next: (u) => {
        this.selfSvc.profile.set(u);
        this.applyLoaded(u);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  private applyLoaded(u: UserView) {
    this.user.set(u);
    this.email.set(u.email ?? '');
    this.phone.set(u.phone ?? '');
    this.profilePhotoUrl.set('');
  }

  protected discardProfile(u: UserView) {
    this.applyLoaded(u);
    this.profileError.set('');
  }

  protected saveProfile() {
    this.savingProfile.set(true);
    this.profileError.set('');
    this.selfSvc
      .updateProfile({
        email: this.email().trim() || undefined,
        phone: this.phone().trim() || undefined,
        profilePhotoUrl: this.profilePhotoUrl().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.load();
        },
        error: (err) => {
          this.savingProfile.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.profileError.set(detalle || 'No pudimos guardar el perfil.');
        },
      });
  }

  protected changePassword() {
    const newPass = this.newPassword();
    if (!this.currentPassword() || newPass.length < 4 || newPass.length > 100) {
      this.passwordError.set('Completa la contraseña actual y una nueva de 4 a 100 caracteres.');
      return;
    }
    if (newPass !== this.confirmPassword()) {
      this.passwordError.set('Las contraseñas no coinciden.');
      return;
    }
    if (newPass === this.currentPassword()) {
      this.passwordError.set('La contraseña nueva debe ser distinta de la actual.');
      return;
    }
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.selfSvc
      .changePassword({ currentPassword: this.currentPassword(), newPassword: newPass })
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.currentPassword.set('');
          this.newPassword.set('');
          this.confirmPassword.set('');
          this.load();
        },
        error: (err) => {
          this.savingPassword.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.passwordError.set(detalle || 'No pudimos cambiar la contraseña.');
        },
      });
  }
}
