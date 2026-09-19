import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { UserAdminService } from '../user-admin';

export interface ResetPasswordDialogData {
  userId: number;
  username: string;
}

/**
 * El admin fija una contraseña nueva directamente — POST
 * /api/users/{id}/reset-password. No pide la contraseña actual ni aplica
 * el límite de 1 vez al mes (esa regla es solo para /me/change-password).
 */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="rpd">
      <h2 class="rpd-title">Restablecer contraseña</h2>
      <p class="rpd-sub">{{ data.username }}</p>

      <ui-field
        label="Nueva contraseña"
        type="password"
        [(value)]="newPassword"
        hint="8-100 caracteres"
      />

      @if (error()) {
        <div class="rpd-error">{{ error() }}</div>
      }

      <div class="rpd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Restablecer
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
      .rpd {
        display: grid;
        gap: 16px;
        width: 100%;
      }
      .rpd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .rpd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .rpd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .rpd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class ResetPasswordDialog {
  protected data = inject<ResetPasswordDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private userSvc = inject(UserAdminService);

  protected newPassword = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    if (this.newPassword().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.userSvc.resetPassword(this.data.userId, { newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle
            ? `No pudimos restablecerla: ${detalle}`
            : 'No pudimos restablecer la contraseña.',
        );
      },
    });
  }
}
