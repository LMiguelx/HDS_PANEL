import { Component, effect, inject, input, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UserAdminService } from './user-admin';
import { UserEditDialog } from './ui/user-edit-dialog';
import { ResetPasswordDialog } from './ui/reset-password-dialog';
import { AssignRolesDialog } from './ui/assign-roles-dialog';
import { UserView } from '../../shared/models/user.models';
import { salesChannelName } from './user-format';

/**
 * Ficha de usuario (GET /api/users/{id}) con las acciones de administración
 * separadas por endpoint: editar datos, restablecer contraseña, cambiar
 * roles, activar/desactivar — cada una es independiente entre sí.
 */
@Component({
  selector: 'app-user-detail',
  imports: [UiButton, UiEmpty],
  template: `
    <section class="ud-page">
      @if (loading()) {
        <div class="ud-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el usuario"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (user(); as u) {
        <div class="ud-head">
          <div>
            <p class="ud-eyebrow">{{ u.code }} · {{ u.username }}</p>
            <h1>{{ u.fullName }}</h1>
            <p class="ud-meta">{{ u.email || 'Sin correo' }} · {{ u.phone || 'Sin teléfono' }}</p>
          </div>
          <div class="ud-actions">
            <button uiButton variant="secondary" (click)="edit(u)">Editar</button>
            <button uiButton variant="secondary" (click)="resetPassword(u)">
              Restablecer contraseña
            </button>
            <button uiButton variant="secondary" (click)="changeRoles(u)">Cambiar roles</button>
            <button uiButton variant="secondary" (click)="activate(u)">Activar</button>
            <button uiButton variant="secondary" (click)="deactivate(u)">Desactivar</button>
          </div>
        </div>

        <div class="ud-grid">
          <div class="ud-field">
            <span class="ud-label">Sede</span>
            <span class="ud-value">{{ u.homeBranchId ? '#' + u.homeBranchId : 'Sin sede' }}</span>
          </div>
          <div class="ud-field">
            <span class="ud-label">Canal de venta</span>
            <span class="ud-value">{{ salesChannelName(u.salesChannelId) }}</span>
          </div>
        </div>

        <h2 class="ud-section-title">Roles</h2>
        @if (u.roles.length === 0) {
          <ui-empty title="Sin roles" body="Este usuario no tiene roles asignados." />
        } @else {
          <div class="ud-roles">
            @for (r of u.roles; track r.roleId) {
              <span class="ud-role-chip">{{ r.name }}</span>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .ud-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ud-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .ud-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .ud-eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 4px 0 4px;
        color: var(--ink);
      }
      .ud-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ud-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ud-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .ud-field {
        display: grid;
        gap: 4px;
      }
      .ud-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .ud-value {
        font-size: 15px;
        color: var(--ink);
      }
      .ud-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 32px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .ud-roles {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ud-role-chip {
        border: 1px solid var(--hairline);
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }

      @media (max-width: 767px) {
        .ud-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class UserDetailPage {
  private userSvc = inject(UserAdminService);
  private dialog = inject(UiDialogService);

  userId = input('', { alias: 'userId' });

  protected salesChannelName = salesChannelName;

  protected user = signal<UserView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  private loadEffect = effect(() => {
    if (this.userId()) this.load();
  });

  load() {
    const id = Number(this.userId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.userSvc.detail(id).subscribe({
      next: (detail) => {
        this.user.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected edit(u: UserView) {
    this.dialog
      .open<UserEditDialog, { user: UserView }, boolean>(UserEditDialog, {
        data: { user: u },
        width: '640px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  protected resetPassword(u: UserView) {
    this.dialog
      .open<ResetPasswordDialog, { userId: number; username: string }, boolean>(
        ResetPasswordDialog,
        { data: { userId: u.userId, username: u.username }, width: '420px' },
      )
      .afterClosed()
      .subscribe();
  }

  protected changeRoles(u: UserView) {
    this.dialog
      .open<
        AssignRolesDialog,
        { userId: number; username: string; currentRoleIds: number[] },
        boolean
      >(AssignRolesDialog, {
        data: {
          userId: u.userId,
          username: u.username,
          currentRoleIds: u.roles.map((r) => r.roleId),
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  protected activate(u: UserView) {
    this.userSvc.activate(u.userId).subscribe(() => this.load());
  }

  protected deactivate(u: UserView) {
    this.dialog
      .confirm({
        title: 'Desactivar usuario',
        message: `¿Desactivar a "${u.fullName}"? Perderá el acceso al sistema.`,
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.userSvc.deactivate(u.userId).subscribe(() => this.load());
      });
  }
}
