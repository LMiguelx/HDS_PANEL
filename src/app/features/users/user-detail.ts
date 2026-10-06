import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UserAdminService } from './user-admin';
import { UserEditDialog } from './ui/user-edit-dialog';
import { ResetPasswordDialog } from './ui/reset-password-dialog';
import { AssignRolesDialog } from './ui/assign-roles-dialog';
import { CompanyAdminService } from '../company/company-admin';
import { UserView } from '../../shared/models/user.models';
import { BranchView } from '../../shared/models/tenant.models';
import { salesChannelName, userInitials } from './user-format';

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
          <span class="ud-avatar">{{ initials(u.fullName) }}</span>
          <div class="ud-head-info">
            <div class="ud-name-row">
              <h1>{{ u.fullName }}</h1>
              <span class="ud-status" [class.ud-status-off]="!u.active">
                {{ u.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <p class="ud-eyebrow">{{ u.code }} · {{ u.username }}</p>
          </div>
        </div>

        <div class="ud-layout">
          <div class="ud-main">
            <div class="ud-card">
              <h2 class="ud-card-title">Datos de la cuenta</h2>
              <div class="ud-data-grid">
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">badge</span>
                  <div>
                    <span class="ud-data-label">Código</span>
                    <span class="ud-data-value">{{ u.code }}</span>
                  </div>
                </div>
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">person</span>
                  <div>
                    <span class="ud-data-label">Usuario</span>
                    <span class="ud-data-value">{{ u.username }}</span>
                  </div>
                </div>
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">mail</span>
                  <div>
                    <span class="ud-data-label">Correo</span>
                    <span class="ud-data-value" [class.ud-data-empty]="!u.email">{{
                      u.email || 'Sin correo'
                    }}</span>
                  </div>
                </div>
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">call</span>
                  <div>
                    <span class="ud-data-label">Teléfono</span>
                    <span class="ud-data-value" [class.ud-data-empty]="!u.phone">{{
                      u.phone || 'Sin teléfono'
                    }}</span>
                  </div>
                </div>
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">storefront</span>
                  <div>
                    <span class="ud-data-label">Sede</span>
                    <span class="ud-data-value" [class.ud-data-empty]="!u.homeBranchId">{{
                      branchName()(u.homeBranchId)
                    }}</span>
                  </div>
                </div>
                <div class="ud-data-item">
                  <span class="material-icons ud-data-icon" aria-hidden="true">sell</span>
                  <div>
                    <span class="ud-data-label">Canal de venta</span>
                    <span class="ud-data-value">{{ salesChannelName(u.salesChannelId) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="ud-card">
              <div class="ud-card-head">
                <h2 class="ud-card-title">Roles asignados</h2>
                <button type="button" class="ud-link" (click)="changeRoles(u)">
                  Cambiar roles
                </button>
              </div>
              @if (u.roles.length === 0) {
                <ui-empty title="Sin roles" body="Este usuario no tiene roles asignados." />
              } @else {
                <div class="ud-roles">
                  @for (r of u.roles; track r.roleId) {
                    <span class="ud-role-chip">{{ r.name }}</span>
                  }
                </div>
              }
            </div>
          </div>

          <div class="ud-side">
            <div class="ud-card ud-actions-card">
              <h2 class="ud-card-title">Acciones</h2>
              <button uiButton variant="primary" (click)="edit(u)">Editar</button>
              <button uiButton variant="secondary" (click)="resetPassword(u)">
                Restablecer contraseña
              </button>
              @if (u.active) {
                <button uiButton variant="secondary" class="ud-btn-danger" (click)="deactivate(u)">
                  Desactivar
                </button>
              } @else {
                <button uiButton variant="secondary" (click)="activate(u)">Activar</button>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .ud-page {
        width: 100%;
        max-width: 1100px;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ud-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .ud-head {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .ud-avatar {
        flex: none;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 20px;
        font-weight: 800;
        background: var(--accent);
        color: var(--on-accent);
      }
      .ud-head-info {
        min-width: 0;
      }
      .ud-name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      h1 {
        font-size: 20px;
        font-weight: 800;
        margin: 0;
        color: var(--ink);
      }
      .ud-status {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        padding: 3px 10px;
        color: var(--st-vigente, #1f8a4c);
        border: 1px solid currentColor;
      }
      .ud-status-off {
        color: var(--ink-muted);
      }
      .ud-eyebrow {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ud-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 20px;
        margin-top: 24px;
        align-items: start;
      }
      .ud-main {
        display: grid;
        gap: 20px;
        min-width: 0;
      }
      .ud-side {
        min-width: 0;
      }
      .ud-card {
        border: 1px solid var(--hairline);
        padding: 20px;
        display: grid;
        gap: 14px;
      }
      .ud-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ud-card-title {
        font-size: 15px;
        font-weight: 800;
        margin: 0;
        color: var(--ink);
      }
      .ud-link {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--accent-ink);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
      }
      .ud-data-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px 14px;
      }
      .ud-data-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
      }
      .ud-data-icon {
        font-size: 20px;
        color: var(--ink-muted);
        margin-top: 1px;
      }
      .ud-data-label {
        display: block;
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .ud-data-value {
        display: block;
        font-size: 14px;
        color: var(--ink);
        word-break: break-word;
      }
      .ud-data-empty {
        color: var(--ink-muted);
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
      .ud-actions-card {
        gap: 10px;
      }
      .ud-actions-card button {
        width: 100%;
        justify-content: center;
      }
      .ud-btn-danger {
        color: var(--accent-ink);
        border-color: var(--accent-ink);
      }

      @media (max-width: 900px) {
        .ud-layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .ud-page {
          padding: var(--sp-4);
        }
        .ud-data-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 479px) {
        .ud-data-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class UserDetailPage {
  private userSvc = inject(UserAdminService);
  private companySvc = inject(CompanyAdminService);
  private dialog = inject(UiDialogService);

  userId = input('', { alias: 'userId' });

  protected salesChannelName = salesChannelName;
  protected initials = userInitials;

  protected user = signal<UserView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected branches = signal<BranchView[]>([]);

  private loadEffect = effect(() => {
    if (this.userId()) this.load();
  });

  protected branchName = computed(() => {
    const byId = new Map(this.branches().map((b) => [b.branchId, b.name]));
    return (homeBranchId: number | null) =>
      homeBranchId ? (byId.get(homeBranchId) ?? `#${homeBranchId}`) : 'Sin sede';
  });

  constructor() {
    this.companySvc.branches().subscribe({
      next: (list) => this.branches.set(list),
      error: () => {},
    });
  }

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
