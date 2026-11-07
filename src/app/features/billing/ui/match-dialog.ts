import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InvoiceAdminService } from '../invoice-admin';

export interface MatchDialogData {
  invoiceId: string;
}

/** Concilia manualmente la factura con un pedido (POST .../match). */
@Component({
  selector: 'app-match-dialog',
  imports: [UiButton, UiField],
  template: `
    <div class="md">
      <h2 class="md-title">Conciliar con pedido</h2>
      <p class="md-sub">{{ data.invoiceId }}</p>

      <ui-field label="Número de pedido" type="number" [(value)]="orderId" />
      <ui-field
        label="Notas (opcional)"
        type="textarea"
        [rows]="2"
        [(value)]="notes"
        hint="Máximo 500 caracteres."
      />

      @if (error()) {
        <div class="md-error">{{ error() }}</div>
      }

      <div class="md-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Conciliar
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
      .md {
        display: grid;
        gap: 16px;
      }
      .md-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .md-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .md-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .md-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class MatchDialog {
  protected data = inject<MatchDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private invoiceSvc = inject(InvoiceAdminService);

  protected orderId = signal('');
  protected notes = signal('');
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    const orderId = Number(this.orderId());
    if (!orderId) {
      this.error.set('Ingresa el número de pedido.');
      return;
    }
    const notes = this.notes().trim();
    if (notes.length > 500) {
      this.error.set('Las notas no pueden superar los 500 caracteres.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.invoiceSvc.match(this.data.invoiceId, { orderId, notes: notes || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.ref.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(
          detalle ? `No pudimos conciliar: ${detalle}` : 'No pudimos conciliar la factura.',
        );
      },
    });
  }
}
