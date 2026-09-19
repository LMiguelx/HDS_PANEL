import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryModuleTabs } from './ui/module-tabs';
import { InventoryAdminService } from './inventory-admin';
import {
  AdjustmentMode,
  BulkStockAdjustmentResult,
  StockAdjustmentLine,
  WarehouseView,
} from '../../shared/models/inventory.models';

const MODE_OPTIONS: UiFieldOption[] = [
  { value: 'SET', label: 'Fijar cantidad (SET)' },
  { value: 'INCREASE', label: 'Aumentar (INCREASE)' },
  { value: 'DECREASE', label: 'Disminuir (DECREASE)' },
];

/**
 * Ajuste manual/masivo de stock — POST /inventory/stock-adjustments.
 * `config.edit`. Es mejor esfuerzo (no todo-o-nada): cada línea se procesa
 * de forma independiente y el resultado trae el detalle de cuáles fallaron.
 * El backend recibe JSON estructurado, no el archivo crudo — el panel solo
 * soporta parseo de CSV (no .xlsx real: no hay librería de parseo de Excel
 * en el proyecto), con carga de línea manual como alternativa siempre
 * disponible.
 */
@Component({
  selector: 'app-stock-adjustment',
  imports: [UiButton, UiField, UiEmpty, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="sa-page">
      <div class="sa-head">
        <h1>Ajuste de stock</h1>
        <p class="sa-sub">
          El modo aplica a todas las líneas. Se procesa mejor esfuerzo: cada línea es
          independiente.
        </p>
      </div>

      <div class="sa-config">
        <ui-field label="Modo" type="select" [(value)]="mode" [options]="modeOptions" />
        <ui-field label="Nota (opcional)" [(value)]="note" />
      </div>

      <div class="sa-csv">
        <label class="sa-csv-label">
          Cargar CSV (columnas: productCode,warehouseId,quantity)
          <input type="file" accept=".csv,text/csv" (change)="onFileSelected($event)" />
        </label>
      </div>

      <table class="ui-table-grid sa-lines-table">
        <thead>
          <tr>
            <th>Código de producto</th>
            <th>Almacén</th>
            <th>Cantidad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (line of lines(); track $index) {
            <tr>
              <td>{{ line.productCode }}</td>
              <td class="sa-muted">{{ warehouseName(line.warehouseId) }}</td>
              <td class="sa-muted">{{ line.quantity }}</td>
              <td class="sa-row-action">
                <button uiButton variant="ghost" size="sm" (click)="removeLine($index)">Quitar</button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="sa-add-row">
        <ui-field label="Código" [(value)]="newProductCode" />
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="newWarehouseId"
          [options]="warehouseOptions()"
          [disabled]="loadingWarehouses()"
        />
        <ui-field label="Cantidad" type="number" [(value)]="newQuantity" />
        <button uiButton variant="secondary" (click)="addLine()">Agregar línea</button>
      </div>

      @if (formError()) {
        <div class="sa-error">{{ formError() }}</div>
      }

      <div class="sa-submit">
        <button
          uiButton
          variant="primary"
          [loading]="submitting()"
          [disabled]="lines().length === 0"
          (click)="submit()"
        >
          Aplicar ajuste ({{ lines().length }} líneas)
        </button>
      </div>

      @if (result(); as r) {
        <div class="sa-result">
          <h2 class="sa-result-title">
            {{ r.appliedCount }} de {{ r.totalLines }} líneas aplicadas
          </h2>
          @if (failedLines(r).length > 0) {
            <div class="sa-failed-list">
              @for (line of failedLines(r); track line.lineIndex) {
                <div class="sa-failed-row">
                  <span class="sa-cell-strong">{{ line.productCode }}</span>
                  <span class="sa-muted">{{ line.errorReason }}</span>
                </div>
              }
            </div>
          } @else {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              title="Todas las líneas se aplicaron"
              body="No hubo líneas rechazadas."
            />
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .sa-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sa-head {
        margin-top: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .sa-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 560px;
      }
      .sa-config {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 14px;
        margin: 24px 0 20px;
      }
      .sa-csv {
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .sa-csv-label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .sa-lines-table {
        margin-bottom: 16px;
      }
      .sa-add-row {
        display: grid;
        grid-template-columns: 1fr 200px 140px auto;
        gap: 12px;
        align-items: end;
        margin-bottom: 20px;
      }
      .sa-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sa-cell-strong {
        font-weight: 800;
      }
      .sa-row-action {
        text-align: right;
      }
      .sa-error {
        color: var(--accent-ink);
        font-size: 13px;
        margin-bottom: 12px;
      }
      .sa-submit {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 24px;
      }
      .sa-result {
        border-top: var(--border-rule);
        padding-top: 20px;
      }
      .sa-result-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 12px;
        color: var(--ink);
      }
      .sa-failed-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .sa-failed-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 8px 10px;
        font-size: 13px;
      }

      @media (max-width: 767px) {
        .sa-page {
          padding: var(--sp-4);
        }
        .sa-add-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StockAdjustmentPage {
  private inventorySvc = inject(InventoryAdminService);

  protected modeOptions = MODE_OPTIONS;
  protected mode = signal<AdjustmentMode>('SET');
  protected note = signal('');

  protected lines = signal<StockAdjustmentLine[]>([]);

  protected newProductCode = signal('');
  protected newWarehouseId = signal('');
  protected newQuantity = signal('');

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  protected formError = signal('');
  protected submitting = signal(false);
  protected result = signal<BulkStockAdjustmentResult | null>(null);

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingWarehouses() ? 'Cargando…' : 'Selecciona un almacén' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  constructor() {
    this.inventorySvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        if (list.length > 0) this.newWarehouseId.set(String(list[0].warehouseId));
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected warehouseName(warehouseId: number): string {
    return this.warehouses().find((w) => w.warehouseId === warehouseId)?.name ?? `#${warehouseId}`;
  }

  protected addLine() {
    const warehouseId = Number(this.newWarehouseId());
    const quantity = Number(this.newQuantity());
    if (!this.newProductCode().trim() || !warehouseId || !quantity || quantity <= 0) {
      this.formError.set('Código, almacén y cantidad (mayor a 0) son obligatorios.');
      return;
    }
    this.formError.set('');
    this.lines.update((rows) => [
      ...rows,
      { productCode: this.newProductCode().trim(), warehouseId, quantity },
    ]);
    this.newProductCode.set('');
    this.newQuantity.set('');
  }

  protected removeLine(index: number) {
    this.lines.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const parsed = this.parseCsv(text);
      if (parsed.length === 0) {
        this.formError.set('No pudimos leer líneas válidas del CSV.');
        return;
      }
      this.formError.set('');
      this.lines.update((rows) => [...rows, ...parsed]);
      input.value = '';
    });
  }

  private parseCsv(text: string): StockAdjustmentLine[] {
    const lines: StockAdjustmentLine[] = [];
    const rows = text.split(/\r?\n/).filter((r) => r.trim());
    for (const row of rows) {
      const [codeRaw, warehouseRaw, quantityRaw] = row.split(',').map((c) => c.trim());
      if (!codeRaw || codeRaw.toLowerCase() === 'productcode') continue; // encabezado
      const warehouseId = Number(warehouseRaw);
      const quantity = Number(quantityRaw);
      if (!codeRaw || !warehouseId || !quantity || quantity <= 0) continue;
      lines.push({ productCode: codeRaw, warehouseId, quantity });
    }
    return lines;
  }

  protected failedLines(result: BulkStockAdjustmentResult) {
    return result.lines.filter((l) => !l.applied);
  }

  protected submit() {
    if (this.lines().length === 0) return;
    this.submitting.set(true);
    this.formError.set('');
    this.result.set(null);
    this.inventorySvc
      .bulkStockAdjustment({
        mode: this.mode(),
        note: this.note().trim() || undefined,
        lines: this.lines(),
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.result.set(result);
          this.lines.set([]);
        },
        error: (err) => {
          this.submitting.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.formError.set(detalle ? `No pudimos aplicar el ajuste: ${detalle}` : 'No pudimos aplicar el ajuste.');
        },
      });
  }
}
