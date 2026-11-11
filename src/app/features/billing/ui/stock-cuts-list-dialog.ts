import { Component, inject } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { NegativeStockReport } from '../../../shared/models/sales-report.models';

export interface StockCutsListDialogData {
  report: NegativeStockReport;
}

/**
 * "Recortar negativos" — lista de negativos de hoy, doc 78, sección 4.5.
 * Misma cuenta que la tarjeta Negativos (mismo `NegativeStockReport`, ya
 * cargado): cada fila abre el recorte de ese producto. Se cierra con el
 * `productId` elegido; quien abre esta ventana es quien abre el recorte.
 */
@Component({
  selector: 'app-stock-cuts-list-dialog',
  imports: [UiButton, UiModal, UiEmpty],
  template: `
    <ui-modal
      title="Recortar negativos"
      [subtitle]="data.report.date + ' · ' + data.report.warehouseName"
      [wide]="true"
      (close)="ref.close(null)"
    >
      @if (data.report.rows.length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          title="No hay negativos hoy"
          body="Lo vendido hoy no supera lo que el ERP tiene de cada producto."
        />
      } @else {
        <table class="ui-table-grid scl-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Vendido hoy</th>
              <th>ERP</th>
              <th>Faltan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.report.rows; track row.productId) {
              <tr>
                <td class="scl-mono">{{ row.productCode }}</td>
                <td>{{ row.productName }}</td>
                <td class="scl-num">{{ row.soldQuantity }}</td>
                <td class="scl-num">
                  @if (row.erpStock == null) {
                    <span [title]="'El ERP nunca informó este producto: cuenta como 0'">—</span>
                  } @else {
                    {{ row.erpStock }}
                  }
                </td>
                <td class="scl-num scl-danger">{{ -row.difference }}</td>
                <td>
                  <button uiButton variant="secondary" size="sm" (click)="ref.close(row.productId)">
                    Recortar ›
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </ui-modal>
  `,
  styles: [
    `
      .scl-table {
        width: 100%;
      }
      .scl-mono {
        font-family: monospace;
      }
      .scl-num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .scl-danger {
        color: var(--status-danger);
        font-weight: 700;
      }
    `,
  ],
})
export class StockCutsListDialog {
  protected data = inject<StockCutsListDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<number | null>);
}
