import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InventoryAdminService } from '../inventory-admin';
import { StockReconciliationView } from '../../../shared/models/inventory.models';
import { dateText, dateTimeText } from '../../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  reconciliationResultLabel,
  reconciliationResultTone,
} from '../inventory-format';

export interface ResyncListDialogData {
  /** yyyy-MM-dd — día del último re-cuadre nocturno (doc 87, sección 5.3). */
  date: string;
}

/**
 * "Ver" de la tarjeta Re-cuadre nocturno — doc 87, sección 5.3: todos los
 * productos que corrigió el último re-cuadre, de cualquier almacén.
 */
@Component({
  selector: 'app-resync-list-dialog',
  imports: [UiButton, UiModal, UiEmpty],
  template: `
    <ui-modal
      title="Re-cuadres del día"
      [subtitle]="dateText(data.date)"
      [wide]="true"
      (close)="ref.close()"
    >
      @if (loading()) {
        <div class="rld-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los re-cuadres"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (rows().length === 0) {
        <ui-empty title="Sin re-cuadres" body="El último re-cuadre no corrigió ningún producto." />
      } @else {
        <table class="ui-table-grid rld-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Almacén</th>
              <th>Ajuste</th>
              <th>Resultado</th>
              <th>Hora</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.uploadId) {
              <tr class="rld-row" (click)="openDetail(row)">
                <td>
                  {{ row.productName }}
                  <div class="rld-muted">{{ row.productCode }}</div>
                </td>
                <td class="rld-muted">{{ row.warehouseName }}</td>
                <td
                  class="rld-num"
                  [class.rld-positive]="(row.appliedDelta ?? 0) > 0"
                  [class.rld-negative]="(row.appliedDelta ?? 0) < 0"
                >
                  @if (row.appliedDelta != null) {
                    {{ row.appliedDelta > 0 ? '+' : '' }}{{ row.appliedDelta }}
                  } @else {
                    —
                  }
                </td>
                <td>
                  <span class="rld-badge" [style.color]="'var(' + toneOf(row) + ')'">{{
                    resultLabel(row)
                  }}</span>
                </td>
                <td class="rld-muted">{{ dateTimeText(row.processedAt) }}</td>
                <td class="rld-chevron">›</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </ui-modal>
  `,
  styles: [
    `
      .rld-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .rld-table {
        width: 100%;
      }
      .rld-row {
        cursor: pointer;
      }
      .rld-row:hover {
        background: var(--faint);
      }
      .rld-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .rld-num {
        font-variant-numeric: var(--tnum);
        font-weight: 700;
        white-space: nowrap;
      }
      .rld-positive {
        color: var(--st-open);
      }
      .rld-negative {
        color: var(--st-mismatch);
      }
      .rld-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
      }
      .rld-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }
    `,
  ],
})
export class ResyncListDialog {
  protected data = inject<ResyncListDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
  private inventorySvc = inject(InventoryAdminService);
  private router = inject(Router);

  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected resultLabel = reconciliationResultLabel;
  protected toneOf = (row: StockReconciliationView) =>
    BADGE_TONE_VAR[reconciliationResultTone(row)];

  protected rows = signal<StockReconciliationView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc
      .reconciliations({ result: 'RESYNC', from: this.data.date, to: this.data.date, size: 200 })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected openDetail(row: StockReconciliationView) {
    this.ref.close();
    this.router.navigate(['/inventario/cuadre', row.uploadId]);
  }
}
