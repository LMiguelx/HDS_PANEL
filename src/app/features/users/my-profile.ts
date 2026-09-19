import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UserSelfService } from './user-self';
import { UserView } from '../../shared/models/user.models';

/**
 * Autoservicio — GET/PATCH /api/users/me + POST /me/change-password.
 * Cualquier usuario autenticado, sin permiso especial. El límite de 1
 * cambio de contraseña al mes lo valida el backend: si se llama antes de
 * tiempo, el error trae la fecha desde la que se puede reintentar.
 */
@Component({
  selector: 'app-my-profile',
  imports: [UiButton, UiField, UiCard, UiEmpty],
  template: `
    <section class="mp-page">
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
        <ui-card variant="container" class="mp-card">
          <div class="mp-card-head">
            <p class="mp-eyebrow">{{ u.code }} · {{ u.username }}</p>
            <h2 class="mp-name">{{ u.fullName }}</h2>
          </div>

          <div class="mp-grid">
            <ui-field label="Correo" [(value)]="email" />
            <ui-field label="Teléfono" [(value)]="phone" />
            <ui-field label="Foto de perfil (URL)" [(value)]="profilePhotoUrl" />
          </div>

          @if (profileError()) {
            <div class="mp-error">{{ profileError() }}</div>
          }
          @if (profileSaved()) {
            <div class="mp-ok">Perfil actualizado.</div>
          }

          <div class="mp-actions">
            <button uiButton variant="primary" [loading]="savingProfile()" (click)="saveProfile()">
              Guardar perfil
            </button>
          </div>
        </ui-card>

        <ui-card variant="container" class="mp-card">
          <h2 class="mp-name">Cambiar contraseña</h2>
          <p class="mp-hint">Solo se permite un cambio de contraseña al mes.</p>

          <div class="mp-grid">
            <ui-field label="Contraseña actual" type="password" [(value)]="currentPassword" />
            <ui-field
              label="Contraseña nueva"
              type="password"
              [(value)]="newPassword"
              hint="8-100 caracteres"
            />
          </div>

          @if (passwordError()) {
            <div class="mp-error">{{ passwordError() }}</div>
          }
          @if (passwordSaved()) {
            <div class="mp-ok">Contraseña actualizada.</div>
          }

          <div class="mp-actions">
            <button
              uiButton
              variant="primary"
              [loading]="savingPassword()"
              (click)="changePassword()"
            >
              Cambiar contraseña
            </button>
          </div>
        </ui-card>
      }
    </section>
  `,
  styles: [
    `
      .mp-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
        max-width: var(--card-w-md);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 20px;
        color: var(--ink);
      }
      .mp-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .mp-card {
        display: grid;
        gap: 16px;
        margin-bottom: 20px;
      }
      .mp-card-head {
        display: grid;
        gap: 2px;
      }
      .mp-eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .mp-name {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .mp-hint {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .mp-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 14px;
      }
      .mp-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .mp-ok {
        color: var(--st-vigente, #0d6b3f);
        font-size: 13px;
      }
      .mp-actions {
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 767px) {
        .mp-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class MyProfilePage {
  private selfSvc = inject(UserSelfService);

  protected user = signal<UserView | null>(null);
  protected loading = signal(true);
  protected loadError = signal(false);

  protected email = signal('');
  protected phone = signal('');
  protected profilePhotoUrl = signal('');
  protected savingProfile = signal(false);
  protected profileError = signal('');
  protected profileSaved = signal(false);

  protected currentPassword = signal('');
  protected newPassword = signal('');
  protected savingPassword = signal(false);
  protected passwordError = signal('');
  protected passwordSaved = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.selfSvc.me().subscribe({
      next: (u) => {
        this.user.set(u);
        this.email.set(u.email ?? '');
        this.phone.set(u.phone ?? '');
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected saveProfile() {
    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileSaved.set(false);
    this.selfSvc
      .updateProfile({
        email: this.email().trim() || undefined,
        phone: this.phone().trim() || undefined,
        profilePhotoUrl: this.profilePhotoUrl().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.profileSaved.set(true);
        },
        error: (err) => {
          this.savingProfile.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.profileError.set(detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar el perfil.');
        },
      });
  }

  protected changePassword() {
    if (!this.currentPassword() || this.newPassword().length < 8) {
      this.passwordError.set('Completa la contraseña actual y una nueva de al menos 8 caracteres.');
      return;
    }
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.passwordSaved.set(false);
    this.selfSvc
      .changePassword({ currentPassword: this.currentPassword(), newPassword: this.newPassword() })
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordSaved.set(true);
          this.currentPassword.set('');
          this.newPassword.set('');
        },
        error: (err) => {
          this.savingPassword.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.passwordError.set(
            detalle ? `No pudimos cambiarla: ${detalle}` : 'No pudimos cambiar la contraseña.',
          );
        },
      });
  }
}
