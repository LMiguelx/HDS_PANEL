import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InventoryAdminService } from '../inventory-admin';
import { StockAdvanceView } from '../../../shared/models/inventory.models';

export interface ReleaseAdvanceDialogData {
  advance: StockAdvanceView;
  /** 'release' = anular todo lo pendiente. 'reduce' = retirar una parte. */
  mode: 'release' | 'reduce';
}

/**
 * Reducir o anular un adelanto — POST /inventory/stock-advances/{id}/release
 * (doc 35, sección 6.5). Mismo endpoint para las dos acciones: sin
 * `quantity` retira todo lo pendiente, con `quantity` retira solo esa parte.
 */
@Component({
  selector: 'app-release-advance-dialog',
  imports: [UiButton, UiField, UiModal],
  template: `
    <ui-modal
      [title]="data.mode === 'release' ? 'Anular adelanto' : 'Reducir adelanto'"
      (close)="ref.close(false)"
    >
      <div class="rad">
        <p class="rad-summary">
          <strong>{{ data.advance.productName }}</strong> · {{ data.advance.warehouseName }}
          <br />
          Pendiente de respaldar: <strong>{{ data.advance.pendingQuantity }}</strong>
        </p>

        @if (data.mode === 'reduce') {
          <ui-field
            label="Cantidad a retirar"
            type="number"
            [(value)]="quantity"
            [hint]="'Máximo ' + data.advance.pendingQuantity"
            [error]="quantityError()"
          />
        } @else {
          <p class="rad-confirm">
            Se retirarán {{ data.advance.pendingQuantity }} del stock de
            {{ data.advance.productName }}. El stock baja de inmediato. ¿Anular el adelanto?
          </p>
        }

        <ui-field
          label="Motivo"
          [(value)]="note"
          hint="Obligatorio, máx. 255"
          [error]="noteError()"
        />

        @if (error()) {
          <div class="rad-error">{{ error() }}</div>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          {{ data.mode === 'release' ? 'Anular adelanto' : 'Reducir' }}
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .rad {
        display: grid;
        gap: 16px;
      }
      .rad-summary {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
        border: 1px solid var(--hairline);
        background: var(--faint);
        padding: 12px 14px;
      }
      .rad-summary strong {
        color: var(--ink);
      }
      .rad-confirm {
        margin: 0;
        font-size: 14px;
        color: var(--ink);
        line-height: 1.5;
      }
      .rad-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
    `,
  ],
})
export class ReleaseAdvanceDialog {
  protected data = inject<ReleaseAdvanceDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<StockAdvanceView | false>);
  private inventorySvc = inject(InventoryAdminService);

  protected quantity = signal('');
  protected note = signal('');
  protected saving = signal(false);
  protected error = signal('');
  protected submitted = signal(false);

  protected quantityError = () => {
    if (!this.submitted() || this.data.mode !== 'reduce') return '';
    const n = Number(this.quantity());
    if (!this.quantity() || !(n > 0)) return 'Ingresa una cantidad mayor a 0';
    if (n > this.data.advance.pendingQuantity) return `Máximo ${this.data.advance.pendingQuantity}`;
    return '';
  };

  protected noteError = () => (this.submitted() && !this.note().trim() ? 'Obligatorio' : '');

  protected submit() {
    this.submitted.set(true);
    const quantity = this.data.mode === 'reduce' ? Number(this.quantity()) : undefined;
    if (this.quantityError() || this.noteError()) return;

    this.saving.set(true);
    this.error.set('');
    this.inventorySvc
      .releaseStockAdvance(this.data.advance.advanceId, { quantity, note: this.note().trim() })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.ref.close(updated);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos procesar el retiro.');
        },
      });
  }
}
