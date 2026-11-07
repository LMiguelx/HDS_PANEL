import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiCheckbox } from '../../../shared/ui/checkbox/checkbox';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { InventoryAdminService } from '../inventory-admin';
import {
  advanceWarningIcon,
  advanceWarningToneVar,
  AdvanceCsvRow,
  ParseAdvancesCsvResult,
} from '../inventory-format';
import { StockAdvanceWarning } from '../../../shared/models/inventory.models';

export interface ImportAdvancesCsvDialogData {
  warehouseId: number;
  warehouseName: string;
  fileName: string;
  parsed: ParseAdvancesCsvResult; // ya leído y parseado — la zona de arrastre vive en la tarjeta
}

export interface ImportedAdvanceLine {
  productCode: string;
  productName: string;
  warehouseId: number;
  quantity: number;
  pendingBefore: number;
}

export interface ImportAdvancesCsvDialogResult {
  lines: ImportedAdvanceLine[];
}

interface PreviewRow {
  rowNumber: number;
  productCode: string;
  productName: string;
  stock: number | null;
  quantity: number | null;
  warehouseId: number;
  formatError: string | null;
  valid: boolean;
  pendingBefore: number | null;
  errorReason: string | null;
  warnings: StockAdvanceWarning[];
}

type RowStatus = 'ready' | 'warning' | 'error';

function rowStatus(row: PreviewRow): RowStatus {
  if (row.formatError || !row.valid) return 'error';
  if (row.warnings.length > 0) return 'warning';
  return 'ready';
}

/**
 * Vista previa del CSV de adelantos — doc 69, sección 6.4. El archivo ya
 * se leyó y parseó en la tarjeta "Nuevo adelanto" (la zona de arrastre vive
 * ahí); este modal solo cruza nombre/stock actual con
 * `/warehouses/{id}/stock` y revisa las filas con `/stock-advances/preview`
 * antes de ofrecer agregarlas a la lista por confirmar. No crea nada.
 */
@Component({
  selector: 'app-import-advances-dialog',
  imports: [UiButton, UiCheckbox],
  template: `
    <div class="iad">
      <h2 class="iad-title">Importar desde CSV</h2>
      <p class="iad-subtitle">Almacén: {{ data.warehouseName }}</p>

      @if (state() === 'reviewing') {
        <div class="iad-loading" role="status" aria-label="Revisando">Revisando…</div>
      } @else {
        <p class="iad-file-summary">
          {{ data.fileName }} · {{ data.parsed.totalFileRows }} filas ·
          {{ rows().length }} producto{{ rows().length === 1 ? '' : 's' }}
          @if (data.parsed.mergedCount > 0) {
            (se sumaron {{ data.parsed.mergedCount }} filas)
          }
        </p>

        <div class="iad-cards-row">
          <div class="iad-counts">
            <span class="iad-count iad-count-ready">{{ readyCount() }} listos</span>
            <span class="iad-count iad-count-warn">{{ warnCount() }} con aviso ⚠</span>
            <span class="iad-count iad-count-error">{{ errorCount() }} con error ✕</span>
          </div>
          <ui-checkbox
            label="Solo con aviso o error"
            [checked]="onlyIssues()"
            (checkedChange)="onlyIssues.set($event)"
          />
        </div>

        <div class="iad-table-wrap">
          <table class="ui-table-grid iad-table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Código</th>
                <th>Producto</th>
                <th>Stock</th>
                <th>Adelantar</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visibleRows(); track row.productCode) {
                <tr>
                  <td class="iad-muted">{{ row.rowNumber }}</td>
                  <td class="iad-mono">{{ row.productCode }}</td>
                  <td>{{ row.productName || '—' }}</td>
                  <td class="iad-num">{{ row.stock ?? '—' }}</td>
                  <td class="iad-num">{{ row.quantity ?? '—' }}</td>
                  <td [title]="statusTitle(row)">
                    @if (rowStatus(row) === 'error') {
                      <span class="iad-status iad-status-error"
                        >✕ {{ row.formatError || row.errorReason }}</span
                      >
                    } @else if (rowStatus(row) === 'warning') {
                      <span
                        class="iad-status"
                        [style.color]="'var(' + tone(row.warnings[0].code) + ')'"
                        >{{ icon(row.warnings[0].code) }} {{ row.warnings[0].message }}</span
                      >
                    } @else {
                      <span class="iad-status iad-status-ready">✓ Listo</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (reviewError()) {
          <div class="iad-error">{{ reviewError() }}</div>
        }

        <div class="iad-actions">
          <button uiButton variant="secondary" (click)="ref.close(null)">Cancelar</button>
          <button
            uiButton
            variant="primary"
            [disabled]="addableRows().length === 0"
            (click)="addToList()"
          >
            Agregar {{ addableRows().length }} producto{{ addableRows().length === 1 ? '' : 's' }}
            a la lista
          </button>
        </div>
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px; width:min(820px, 90vw);',
  },
  styles: [
    `
      .iad {
        display: grid;
        gap: 14px;
      }
      .iad-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .iad-subtitle {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .iad-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .iad-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .iad-file-summary {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .iad-cards-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .iad-counts {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .iad-count {
        border: 1px solid var(--hairline);
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
      }
      .iad-count-ready {
        color: var(--ink-muted);
      }
      .iad-count-warn {
        color: var(--status-warn);
        border-color: var(--status-warn);
      }
      .iad-count-error {
        color: var(--status-danger);
        border-color: var(--status-danger);
      }
      .iad-table-wrap {
        max-height: 360px;
        overflow-y: auto;
        border: 1px solid var(--hairline);
      }
      .iad-table {
        width: 100%;
      }
      .iad-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .iad-mono {
        font-variant-numeric: var(--tnum);
        font-size: 12px;
        color: var(--ink-muted);
      }
      .iad-num {
        font-variant-numeric: var(--tnum);
        text-align: right;
      }
      .iad-status {
        font-size: 12px;
        font-weight: 600;
      }
      .iad-status-ready {
        color: var(--ink-muted);
      }
      .iad-status-error {
        color: var(--status-danger);
      }
      .iad-loading {
        padding: 40px 0;
        text-align: center;
        color: var(--ink-muted);
        font-size: 13px;
      }
    `,
  ],
})
export class ImportAdvancesCsvDialog {
  protected data = inject<ImportAdvancesCsvDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<ImportAdvancesCsvDialogResult | null>);
  private inventorySvc = inject(InventoryAdminService);

  protected icon = advanceWarningIcon;
  protected tone = advanceWarningToneVar;
  protected rowStatus = rowStatus;

  protected state = signal<'reviewing' | 'preview'>('reviewing');
  protected rows = signal<PreviewRow[]>([]);
  protected onlyIssues = signal(false);
  protected reviewError = signal('');

  protected visibleRows = computed(() =>
    this.onlyIssues() ? this.rows().filter((r) => rowStatus(r) !== 'ready') : this.rows(),
  );
  protected readyCount = computed(() => this.rows().filter((r) => rowStatus(r) === 'ready').length);
  protected warnCount = computed(
    () => this.rows().filter((r) => rowStatus(r) === 'warning').length,
  );
  protected errorCount = computed(() => this.rows().filter((r) => rowStatus(r) === 'error').length);
  protected addableRows = computed(() => this.rows().filter((r) => rowStatus(r) !== 'error'));

  constructor() {
    this.inventorySvc.warehouseStock(this.data.warehouseId).subscribe({
      next: (stock) => {
        const map = new Map<string, { name: string; stock: number }>();
        for (const item of stock.items) {
          map.set(item.productCode, { name: item.productName, stock: item.quantity });
        }
        this.runPreview(map);
      },
      // Sin stock cruzado no se bloquea la importación: solo no habrá nombre/stock.
      error: () => this.runPreview(new Map()),
    });
  }

  protected statusTitle(row: PreviewRow): string {
    return row.warnings.map((w) => w.message).join(' · ');
  }

  private runPreview(stockMap: Map<string, { name: string; stock: number }>) {
    const csvRows = this.data.parsed.rows;
    const toReview = csvRows.filter((r) => !r.formatError && r.quantity != null);
    if (toReview.length === 0) {
      this.rows.set(this.buildRows(csvRows, stockMap, []));
      this.state.set('preview');
      return;
    }
    this.inventorySvc
      .previewStockAdvances({
        lines: toReview.map((r) => ({
          productCode: r.productCode,
          warehouseId: r.warehouseId ?? this.data.warehouseId,
          quantity: r.quantity!,
        })),
      })
      .subscribe({
        next: (preview) => {
          this.rows.set(this.buildRows(csvRows, stockMap, preview.lines));
          this.state.set('preview');
        },
        error: () => {
          this.reviewError.set('No se pudo revisar el adelanto. Inténtalo de nuevo.');
          this.rows.set(this.buildRows(csvRows, stockMap, []));
          this.state.set('preview');
        },
      });
  }

  private buildRows(
    csvRows: AdvanceCsvRow[],
    stockMap: Map<string, { name: string; stock: number }>,
    previewLines: {
      lineIndex: number;
      valid: boolean;
      pendingBefore: number | null;
      errorReason: string | null;
      warnings: StockAdvanceWarning[];
    }[],
  ): PreviewRow[] {
    let reviewIdx = 0;
    return csvRows.map((r) => {
      const stockInfo = stockMap.get(r.productCode);
      if (r.formatError || r.quantity == null) {
        return {
          rowNumber: r.rowNumber,
          productCode: r.productCode,
          productName: stockInfo?.name ?? '',
          stock: stockInfo?.stock ?? null,
          quantity: r.quantity,
          warehouseId: r.warehouseId ?? this.data.warehouseId,
          formatError: r.formatError,
          valid: false,
          pendingBefore: null,
          errorReason: null,
          warnings: [],
        };
      }
      const p = previewLines.find((l) => l.lineIndex === reviewIdx);
      reviewIdx++;
      return {
        rowNumber: r.rowNumber,
        productCode: r.productCode,
        productName: stockInfo?.name ?? '',
        stock: stockInfo?.stock ?? null,
        quantity: r.quantity,
        warehouseId: r.warehouseId ?? this.data.warehouseId,
        formatError: null,
        valid: p?.valid ?? true,
        pendingBefore: p?.pendingBefore ?? null,
        errorReason: p?.errorReason ?? null,
        warnings: p?.warnings ?? [],
      };
    });
  }

  protected addToList() {
    const lines: ImportedAdvanceLine[] = this.addableRows().map((r) => ({
      productCode: r.productCode,
      productName: r.productName || r.productCode,
      warehouseId: r.warehouseId,
      quantity: r.quantity ?? 0,
      pendingBefore: r.pendingBefore ?? 0,
    }));
    this.ref.close({ lines });
  }
}
