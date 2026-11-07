import { Component, inject } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { BatchResolutionResult } from '../../../shared/models/order.models';

/**
 * Resumen del lote — doc 51, sección 8.4. Solo se abre cuando hay fallidos
 * (con 0 fallidos basta el toast); muestra el motivo de cada pedido que no
 * se resolvió, tal como llega del backend.
 */
@Component({
  selector: 'app-resolve-batch-result-dialog',
  imports: [UiButton],
  template: `
    <div class="rbr">
      <div class="rbr-head">
        <h2 class="rbr-title">Resultado</h2>
        <button type="button" class="rbr-close" aria-label="Cerrar" (click)="ref.close()">✕</button>
      </div>
      <p class="rbr-summary">
        <span class="rbr-ok"
          >✓ {{ data.resolved }} resuelto{{ data.resolved === 1 ? '' : 's' }}</span
        >
        @if (data.failed > 0) {
          <span class="rbr-fail"
            >✕ {{ data.failed }} no se pudo{{ data.failed === 1 ? '' : 'ieron' }} resolver</span
          >
        }
      </p>

      <div class="rbr-list">
        @for (row of data.results; track row.orderId) {
          <div class="rbr-row" [class.fail]="!row.resolved">
            <span class="rbr-order">N.º {{ row.orderId }}</span>
            <span class="rbr-result">
              @if (row.resolved) {
                ✓ Sustituido
              } @else {
                ✕ {{ row.message }}
              }
            </span>
          </div>
        }
      </div>

      <div class="rbr-actions">
        <button uiButton variant="primary" (click)="ref.close()">Entendido</button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .rbr {
        display: grid;
        gap: 14px;
      }
      .rbr-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .rbr-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .rbr-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--ink-muted);
        font-size: 16px;
        padding: 2px;
      }
      .rbr-summary {
        margin: 0;
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 13px;
        font-weight: 700;
      }
      .rbr-ok {
        color: var(--success);
      }
      .rbr-fail {
        color: var(--status-danger);
      }
      .rbr-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        max-height: 280px;
        overflow-y: auto;
      }
      .rbr-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 10px 12px;
        font-size: 13px;
      }
      .rbr-row.fail .rbr-result {
        color: var(--status-danger);
      }
      .rbr-order {
        flex: none;
        font-weight: 700;
        color: var(--ink);
      }
      .rbr-result {
        text-align: right;
        color: var(--ink);
      }
      .rbr-actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ResolveBatchResultDialog {
  protected data = inject<BatchResolutionResult>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
}
