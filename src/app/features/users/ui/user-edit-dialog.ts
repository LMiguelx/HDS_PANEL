import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { UserAdminService } from '../user-admin';
import { CompanyAdminService } from '../../company/company-admin';
import { BranchView } from '../../../shared/models/tenant.models';
import { UserView } from '../../../shared/models/user.models';

export interface UserEditDialogData {
  user: UserView;
}

/**
 * Edición de datos operativos de otro usuario — PATCH /api/users/{id}.
 * `username`/`code` quedan fuera a propósito (inmutables tras el alta).
 */
@Component({
  selector: 'app-user-edit-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="ued">
      <h2 class="ued-title">Editar usuario</h2>
      <p class="ued-sub">{{ data.user.username }}</p>

      <div class="ued-grid">
        <ui-field label="Nombres" [(value)]="firstName" />
        <ui-field label="Apellidos" [(value)]="lastName" />
        <ui-field label="Correo" [(value)]="email" />
        <ui-field label="Teléfono" [(value)]="phone" />
        <ui-field
          label="Sede"
          type="select"
          [(value)]="homeBranchId"
          [options]="branchOptions()"
          [disabled]="loadingBranches()"
        />
        <ui-field label="Canal de venta (id)" type="number" [(value)]="salesChannelId" />
      </div>

      @if (error()) {
        <div class="ued-error">{{ error() }}</div>
      }

      <div class="ued-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar cambios
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
      .ued {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .ued-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .ued-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ued-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 14px;
      }
      .ued-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .ued-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class UserEditDialog {
  protected data = inject<UserEditDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private userSvc = inject(UserAdminService);
  private companySvc = inject(CompanyAdminService);

  protected firstName = signal(this.data.user.firstName);
  protected lastName = signal(this.data.user.lastName ?? '');
  protected email = signal(this.data.user.email ?? '');
  protected phone = signal(this.data.user.phone ?? '');
  protected homeBranchId = signal(String(this.data.user.homeBranchId ?? ''));
  protected salesChannelId = signal(String(this.data.user.salesChannelId ?? ''));

  protected branches = signal<BranchView[]>([]);
  protected loadingBranches = signal(true);
  protected saving = signal(false);
  protected error = signal('');

  protected branchOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Sin sede' },
    ...this.branches().map((b) => ({ value: String(b.branchId), label: b.name })),
  ]);

  constructor() {
    this.companySvc.branches().subscribe({
      next: (list) => {
        this.branches.set(list.filter((b) => b.active));
        this.loadingBranches.set(false);
      },
      error: () => this.loadingBranches.set(false),
    });
  }

  protected submit() {
    const salesChannelId = Number(this.salesChannelId());
    if (!this.firstName().trim() || !salesChannelId) {
      this.error.set('Nombres y canal de venta son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.userSvc
      .update(this.data.user.userId, {
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim() || undefined,
        email: this.email().trim() || undefined,
        phone: this.phone().trim() || undefined,
        homeBranchId: this.homeBranchId() ? Number(this.homeBranchId()) : undefined,
        salesChannelId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.ref.close(true);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar los cambios.',
          );
        },
      });
  }
}
