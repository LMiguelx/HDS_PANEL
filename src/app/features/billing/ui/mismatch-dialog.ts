import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InvoiceAdminService } from '../invoice-admin';

export interface MismatchDialogData {
  invoiceId: string;
}

/** Marca la factura con diferencias detectadas frente al pedido (POST .../mismatch). */
@Component({
  selector: 'app-mismatch-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="msd">
      <h2 class="msd-title">Marcar con diferencias</h2>
      <p class="msd-sub">{{ data.invoiceId }}</p>

      <ui-field
        label="Notas"
        type="textarea"
        [rows]="3"
        [(value)]="notes"
        hint="Obligatorio, máximo 500 caracteres — describe la diferencia encontrada."
      />

      @if (error()) {
        <div class="msd-error">{{ error() }}</div>
      }

      <div class="msd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Marcar con diferencias
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
      .msd {
        display: grid;
        gap: 16px;
      }
      .msd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .msd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .msd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .msd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class MismatchDialog {
  protected data = inject<MismatchDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private invoiceSvc = inject(InvoiceAdminService);

  protected notes = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    const notes = this.notes().trim();
    if (!notes) {
      this.error.set('Las notas son obligatorias.');
      return;
    }
    if (notes.length > 500) {
      this.error.set('Las notas no pueden superar los 500 caracteres.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.invoiceSvc.mismatch(this.data.invoiceId, { notes }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(detalle ? `No pudimos marcar: ${detalle}` : 'No pudimos marcar la factura.');
      },
    });
  }
}
