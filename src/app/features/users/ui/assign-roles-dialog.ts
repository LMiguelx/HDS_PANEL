import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { UserAdminService } from '../user-admin';
import { RoleLookupService } from '../role-lookup';
import { Role } from '../../../shared/models/auth.models';

export interface AssignRolesDialogData {
  userId: number;
  username: string;
  currentRoleIds: number[];
}

/**
 * Reemplaza el set completo de roles del usuario — PUT
 * /api/users/{id}/roles. No es incremental: el panel manda la lista final
 * completa. Siempre debe quedar al menos 1 rol.
 */
@Component({
  selector: 'app-assign-roles-dialog',
  imports: [UiButton],
  template: `
    <div class="ard">
      <h2 class="ard-title">Cambiar roles</h2>
      <p class="ard-sub">{{ data.username }}</p>

      @if (loading()) {
        <span class="ard-muted">Cargando…</span>
      } @else {
        <div class="ard-roles-list">
          @for (r of roles(); track r.roleId) {
            <label class="ard-role-row">
              <input
                type="checkbox"
                [checked]="selectedRoleIds().has(r.roleId)"
                (change)="toggle(r.roleId)"
              />
              <span>{{ r.name }}</span>
            </label>
          }
        </div>
      }

      @if (error()) {
        <div class="ard-error">{{ error() }}</div>
      }

      <div class="ard-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar roles
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .ard {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .ard-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .ard-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ard-muted {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ard-roles-list {
        display: grid;
        gap: 8px;
        border: 1px solid var(--hairline);
        padding: 12px 14px;
        max-height: 220px;
        overflow-y: auto;
      }
      .ard-role-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--ink);
      }
      .ard-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .ard-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class AssignRolesDialog {
  protected data = inject<AssignRolesDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private userSvc = inject(UserAdminService);
  private roleSvc = inject(RoleLookupService);

  protected roles = signal<Role[]>([]);
  protected loading = signal(true);
  protected selectedRoleIds = signal<Set<number>>(new Set(this.data.currentRoleIds));
  protected saving = signal(false);
  protected error = signal('');

  constructor() {
    this.roleSvc.list().subscribe({
      next: (list) => {
        this.roles.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggle(roleId: number) {
    const next = new Set(this.selectedRoleIds());
    if (next.has(roleId)) next.delete(roleId);
    else next.add(roleId);
    this.selectedRoleIds.set(next);
  }

  protected submit() {
    if (this.selectedRoleIds().size === 0) {
      this.error.set('Debe quedar al menos un rol seleccionado.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.userSvc.assignRoles(this.data.userId, { roleIds: [...this.selectedRoleIds()] }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar los roles.',
        );
      },
    });
  }
}
