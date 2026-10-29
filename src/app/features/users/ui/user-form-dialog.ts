import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
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
  imports: [UiButton, UiField, UiModal],
  template: `
    <ui-modal title="Nuevo usuario" (close)="ref.close(false)">
      <div class="ufd">
        <div class="ufd-grid">
          <ui-field
            label="Código"
            [(value)]="code"
            hint="Máx. 10 — único"
            [error]="submitted() && !code().trim() ? 'Obligatorio' : ''"
          />
          <ui-field
            label="Usuario (login)"
            [(value)]="username"
            hint="Máx. 60 — único"
            [error]="submitted() && !username().trim() ? 'Obligatorio' : ''"
          />

          <ui-field
            label="Contraseña"
            [type]="hidePassword() ? 'password' : 'text'"
            icon="lock"
            [hasSuffix]="true"
            [(value)]="password"
            hint="8-100 caracteres"
            [error]="passwordError()"
          >
            <button
              type="button"
              fieldSuffix
              class="ufd-eye"
              [attr.aria-label]="hidePassword() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
              (click)="hidePassword.set(!hidePassword())"
            >
              <span class="material-icons" aria-hidden="true">{{
                hidePassword() ? 'visibility' : 'visibility_off'
              }}</span>
            </button>
          </ui-field>
          <ui-field
            label="Sede"
            type="select"
            [(value)]="homeBranchId"
            [options]="branchOptions()"
            [disabled]="loadingBranches()"
          />

          <ui-field
            label="Nombres"
            [(value)]="firstName"
            [error]="submitted() && !firstName().trim() ? 'Obligatorio' : ''"
          />
          <ui-field label="Apellidos" [(value)]="lastName" />

          <ui-field label="Correo" [(value)]="email" />
          <ui-field label="Teléfono" [(value)]="phone" />

          <ui-field
            class="ufd-span-2"
            label="Canal de venta"
            type="select"
            [(value)]="salesChannelId"
            [options]="salesChannelOptions"
            [error]="submitted() && salesChannelId() === '' ? 'Obligatorio' : ''"
          />
        </div>

        <div
          class="ufd-roles"
          [class.ufd-roles-error]="submitted() && selectedRoleIds().size === 0"
        >
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
          @if (submitted() && selectedRoleIds().size === 0) {
            <span class="ufd-roles-error-text">Elige al menos un rol</span>
          }
        </div>

        @if (error()) {
          <div class="ufd-error">{{ error() }}</div>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Crear usuario
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .ufd {
        display: grid;
        gap: 18px;
        width: 100%;
      }
      .ufd-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .ufd-span-2 {
        grid-column: 1 / -1;
      }
      .ufd-eye {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        appearance: none;
        border: none;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
      }
      .ufd-eye:hover {
        color: var(--ink);
      }
      .ufd-eye .material-icons {
        font-size: 20px;
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
      .ufd-roles-error .ufd-roles-list {
        border-color: var(--st-vencida, #d13b3b);
      }
      .ufd-roles-error-text {
        font-size: 12px;
        color: var(--accent-ink);
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

      @media (max-width: 599px) {
        .ufd-grid {
          grid-template-columns: 1fr;
        }
        .ufd-span-2 {
          grid-column: auto;
        }
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
  protected hidePassword = signal(true);
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
  protected submitted = signal(false);
  protected error = signal('');

  protected branchOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Sin sede' },
    ...this.branches().map((b) => ({ value: String(b.branchId), label: b.name })),
  ]);

  protected passwordError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.password()) return 'Obligatorio';
    if (this.password().length < 8) return 'Mínimo 8 caracteres';
    return '';
  });

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
    this.submitted.set(true);
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
      this.error.set('Revisa los campos marcados en rojo.');
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
