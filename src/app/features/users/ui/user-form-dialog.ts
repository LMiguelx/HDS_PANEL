import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { UserAdminService } from '../user-admin';
import { RoleLookupService } from '../role-lookup';
import { CompanyAdminService } from '../../company/company-admin';
import { SALES_CHANNEL_OPTIONS } from '../user-format';
import { Role } from '../../../shared/models/auth.models';
import { BranchView } from '../../../shared/models/tenant.models';
import { UserCreatedResult } from '../../../shared/models/user.models';

/** Alta de usuario — POST /api/users. `user.manage`. */
@Component({
  selector: 'app-user-form-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="ufd">
      <h2 class="ufd-title">Nuevo usuario</h2>

      <div class="ufd-grid">
        <ui-field label="Código" [(value)]="code" hint="Máx. 10 — único" />
        <ui-field label="Usuario (login)" [(value)]="username" hint="Máx. 60 — único" />
        <ui-field label="Contraseña" type="password" [(value)]="password" hint="8-100 caracteres" />
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
        <ui-field
          label="Canal de venta"
          type="select"
          [(value)]="salesChannelId"
          [options]="salesChannelOptions"
        />
      </div>

      <div class="ufd-roles">
        <span class="ufd-roles-label">Roles</span>
        @if (loadingRoles()) {
          <span class="ufd-muted">Cargando…</span>
        } @else {
          <div class="ufd-roles-list">
            @for (r of roles(); track r.roleId) {
              <label class="ufd-role-row">
                <input
                  type="checkbox"
                  [checked]="selectedRoleIds().has(r.roleId)"
                  (change)="toggleRole(r.roleId)"
                />
                <span>{{ r.name }}</span>
              </label>
            }
          </div>
        }
      </div>

      @if (error()) {
        <div class="ufd-error">{{ error() }}</div>
      }

      <div class="ufd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Crear usuario
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
      .ufd {
        display: grid;
        gap: 18px;
        width: 100%;
      }
      .ufd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .ufd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 14px;
      }
      .ufd-roles {
        display: grid;
        gap: 8px;
      }
      .ufd-roles-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ufd-muted {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ufd-roles-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
        gap: 8px;
        border: 1px solid var(--hairline);
        padding: 12px 14px;
        max-height: 180px;
        overflow-y: auto;
      }
      .ufd-role-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--ink);
      }
      .ufd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .ufd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class UserFormDialog {
  protected ref = inject(UiDialogRef<UserCreatedResult | false>);
  private userSvc = inject(UserAdminService);
  private roleSvc = inject(RoleLookupService);
  private companySvc = inject(CompanyAdminService);

  protected salesChannelOptions = SALES_CHANNEL_OPTIONS;

  protected code = signal('');
  protected username = signal('');
  protected password = signal('');
  protected firstName = signal('');
  protected lastName = signal('');
  protected email = signal('');
  protected phone = signal('');
  protected homeBranchId = signal('');
  protected salesChannelId = signal('0');

  protected roles = signal<Role[]>([]);
  protected loadingRoles = signal(true);
  protected selectedRoleIds = signal<Set<number>>(new Set());

  protected branches = signal<BranchView[]>([]);
  protected loadingBranches = signal(true);

  protected saving = signal(false);
  protected error = signal('');

  protected branchOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Sin sede' },
    ...this.branches().map((b) => ({ value: String(b.branchId), label: b.name })),
  ]);

  constructor() {
    this.roleSvc.list().subscribe({
      next: (list) => {
        this.roles.set(list);
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false),
    });
    this.companySvc.branches().subscribe({
      next: (list) => {
        this.branches.set(list.filter((b) => b.active));
        this.loadingBranches.set(false);
      },
      error: () => this.loadingBranches.set(false),
    });
  }

  protected toggleRole(roleId: number) {
    const next = new Set(this.selectedRoleIds());
    if (next.has(roleId)) next.delete(roleId);
    else next.add(roleId);
    this.selectedRoleIds.set(next);
  }

  protected submit() {
    const salesChannelId = Number(this.salesChannelId());
    const hasPasswordLengthIssue = this.password().length > 0 && this.password().length < 8;

    if (
      !this.code().trim() ||
      !this.username().trim() ||
      !this.password() ||
      hasPasswordLengthIssue ||
      !this.firstName().trim() ||
      this.salesChannelId() === '' ||
      this.selectedRoleIds().size === 0
    ) {
      this.error.set(
        hasPasswordLengthIssue
          ? 'La contraseña debe tener al menos 8 caracteres.'
          : 'Código, usuario, contraseña, nombres, canal de venta y al menos un rol son obligatorios.',
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.userSvc
      .create({
        code: this.code().trim(),
        username: this.username().trim(),
        password: this.password(),
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim() || undefined,
        email: this.email().trim() || undefined,
        phone: this.phone().trim() || undefined,
        homeBranchId: this.homeBranchId() ? Number(this.homeBranchId()) : undefined,
        salesChannelId,
        roleIds: [...this.selectedRoleIds()],
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.ref.close(result);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle ? `No pudimos crear el usuario: ${detalle}` : 'No pudimos crear el usuario.',
          );
        },
      });
  }
}
