import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, map, reduce } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { InventoryModuleTabs } from './ui/module-tabs';
import { InventoryAdminService } from './inventory-admin';
import { ProductAdminService } from '../catalog/product-admin';
import { ToastService } from '../../core/ui/toast';
import {
  AdjustmentMode,
  BulkStockAdjustmentResult,
  WarehouseView,
} from '../../shared/models/inventory.models';
import { downloadCsvTemplate, parseStockCsv, toProductLookup } from './inventory-format';

const BATCH_SIZE = 500;

const MODE_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Elige un modo…' },
  { value: 'INCREASE', label: 'Sumar' },
  { value: 'DECREASE', label: 'Restar' },
  { value: 'SET', label: 'Fijar cantidad' },
];

interface DraftLine {
  productCode: string;
  productName: string;
  warehouseId: number;
  quantity: number;
  actualStock: number | null; // null = línea de CSV, sin stock consultado
}

interface ResultRow extends DraftLine {
  state: 'applied' | 'nochange' | 'failed';
  appliedDelta: number | null;
  errorReason: string | null;
}

function previstoText(mode: AdjustmentMode, actual: number | null, quantity: number) {
  if (actual == null) return { text: '—', negative: false };
  if (mode === 'INCREASE')
    return { text: `${actual} → ${actual + quantity} (+${quantity})`, negative: false };
  if (mode === 'DECREASE') {
    const after = actual - quantity;
    return { text: `${actual} → ${after} (−${quantity})`, negative: after < 0 };
  }
  const diff = quantity - actual;
  const sign = diff > 0 ? '+' : '';
  return { text: `${actual} → ${quantity} (${sign}${diff})`, negative: false };
}

/**
 * Ajuste de stock (correcciones) — POST /inventory/stock-adjustments, doc 35
 * sección 7. Solo para corregir existencias; para mercadería que está por
 * llegar se usa Adelantos. `config.edit`. Mejor esfuerzo: cada línea se
 * procesa por separado y el resultado trae el detalle de cuáles fallaron.
 */
@Component({
  selector: 'app-stock-adjustment',
  imports: [RouterLink, UiButton, UiField, UiTypeahead, UiEmpty, UiInfoTip, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="sa-page">
      <div class="sa-head">
        <h1>Ajuste de stock</h1>
        <div class="sa-banner">
          ⚠ Una corrección dura hasta la próxima subida del ERP. Si el ERP no tiene el mismo cambio,
          su siguiente subida lo deshace. Para habilitar mercadería que está por llegar, usa
          <a routerLink="/inventario/adelantos">Adelantos</a>.
        </div>
        @if (prefillNote()) {
          <p class="sa-prefill">{{ prefillNote() }}</p>
        }
      </div>

      <div class="sa-layout">
        <div class="sa-main">
          <div class="sa-config">
            <ui-field
              label="Modo"
              type="select"
              [(value)]="mode"
              [options]="modeOptions"
              [error]="submitted() && !mode() ? 'Elige un modo' : ''"
            />
            <ui-field
              label="Almacén"
              type="select"
              [(value)]="warehouseId"
              [options]="warehouseOptions()"
              [disabled]="loadingWarehouses()"
            />
            <ui-field label="Nota (opcional)" [(value)]="note" />
          </div>

          <ui-typeahead
            label="Buscar producto"
            placeholder="Código o nombre"
            [search]="productSearch"
            [selected]="pickedProduct()"
            (picked)="onProductPicked($event)"
          />
          <div class="sa-add-row">
            <ui-field
              label="Cantidad"
              type="number"
              [(value)]="draftQuantity"
              hint="Siempre sin signo — el modo decide"
            />
            <button uiButton variant="secondary" (click)="addLine()">Agregar línea</button>
          </div>
          @if (addLineError()) {
            <div class="sa-error">{{ addLineError() }}</div>
          }

          @if (!lastResult()) {
            @if (lines().length > 0) {
              <table class="ui-table-grid sa-lines-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Actual</th>
                    <th>Cant.</th>
                    <th>
                      Previsto
                      <span
                        uiInfoTip="Cálculo del panel, solo de referencia. El servidor decide el valor real al aplicar."
                      ></span>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines(); track line.productCode) {
                    <tr>
                      <td class="sa-muted">{{ line.productCode }}</td>
                      <td>{{ line.productName }}</td>
                      <td class="sa-muted">{{ line.actualStock ?? '—' }}</td>
                      <td class="sa-qty">{{ line.quantity }}</td>
                      <td [class.sa-negative]="previsto(line).negative">
                        {{ previsto(line).text }}
                      </td>
                      <td class="sa-row-action">
                        <button
                          uiButton
                          variant="ghost"
                          size="sm"
                          (click)="removeLine(line.productCode)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <ui-empty
                title="Sin líneas todavía"
                body="Busca un producto o importa un CSV para empezar."
              />
            }
          } @else {
            <table class="ui-table-grid sa-lines-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                @for (row of resultRows(); track row.productCode) {
                  <tr [class.sa-row-failed]="row.state === 'failed'">
                    <td>
                      @switch (row.state) {
                        @case ('applied') {
                          <span class="sa-icon sa-icon-ok">✓</span>
                        }
                        @case ('nochange') {
                          <span class="sa-icon sa-icon-nochange">✓</span>
                        }
                        @case ('failed') {
                          <span class="sa-icon sa-icon-fail">✕</span>
                        }
                      }
                    </td>
                    <td class="sa-muted">{{ row.productCode }}</td>
                    <td>{{ row.productName }}</td>
                    <td class="sa-qty">{{ row.quantity }}</td>
                    <td>
                      @if (row.state === 'applied') {
                        <span
                          [class.sa-positive]="(row.appliedDelta ?? 0) > 0"
                          [class.sa-negative]="(row.appliedDelta ?? 0) < 0"
                        >
                          {{ row.appliedDelta != null && row.appliedDelta > 0 ? '+' : ''
                          }}{{ row.appliedDelta }}
                        </span>
                      } @else if (row.state === 'nochange') {
                        <span class="sa-muted">Sin cambio</span>
                      } @else {
                        <span class="sa-negative">{{ row.errorReason }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            <div class="sa-result-summary">
              <p class="sa-result-title">
                {{ lastResult()!.appliedCount }} de {{ lastResult()!.totalLines }} líneas aplicadas
              </p>
              <div class="sa-result-actions">
                @if (failedCount() > 0) {
                  <button uiButton variant="secondary" (click)="correctFailed()">
                    Corregir las no aplicadas ({{ failedCount() }})
                  </button>
                }
                <button uiButton variant="secondary" (click)="reset()">Nuevo ajuste</button>
                @if (failedCount() === 0) {
                  <button uiButton variant="ghost" routerLink="/inventario">
                    Ver Stock por almacén
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <div class="sa-side">
          <div class="sa-csv-card">
            <h2 class="sa-card-title">Importar desde CSV</h2>
            <p class="sa-muted">Columnas: productCode, warehouseId, quantity</p>
            <label class="sa-csv-label">
              <input type="file" accept=".csv,text/csv" (change)="onFileSelected($event)" />
            </label>
            <button uiButton variant="ghost" size="sm" (click)="downloadCsvTemplate()">
              ↓ Descargar plantilla
            </button>
          </div>
        </div>
      </div>

      @if (!lastResult()) {
        <div class="sa-footer">
          <span class="sa-footer-summary">
            {{ lines().length }} línea{{ lines().length === 1 ? '' : 's' }}
            @if (mode()) {
              · {{ modeLabel() }}
            }
            @if (warehouseName()) {
              · {{ warehouseName() }}
            }
          </span>
          <div class="sa-footer-actions">
            <button
              uiButton
              variant="secondary"
              [disabled]="lines().length === 0"
              (click)="clearLines()"
            >
              Limpiar
            </button>
            <button
              uiButton
              variant="primary"
              [loading]="submitting()"
              [disabled]="lines().length === 0"
              (click)="confirmSubmit()"
            >
              Aplicar ajuste ({{ lines().length }})
            </button>
          </div>
        </div>
      }

      @if (formError()) {
        <div class="sa-error sa-error-bottom">{{ formError() }}</div>
      }
    </section>
  `,
  styles: [
    `
      .sa-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
        padding-bottom: 90px;
      }
      .sa-head {
        margin: 20px 0;
        display: grid;
        gap: 10px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .sa-banner {
        font-size: 13px;
        color: var(--ink);
        border: 1px solid var(--st-in-route);
        background: color-mix(in srgb, var(--st-in-route) 8%, transparent);
        padding: 10px 14px;
      }
      .sa-banner a {
        color: var(--accent-ink);
        font-weight: 700;
      }
      .sa-prefill {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sa-layout {
        display: grid;
        grid-template-columns: 1fr 280px;
        gap: 24px;
        align-items: start;
      }
      .sa-main {
        display: grid;
        gap: 16px;
        min-width: 0;
      }
      .sa-config {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 14px;
      }
      .sa-add-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
      }
      .sa-lines-table {
        width: 100%;
      }
      .sa-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sa-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .sa-positive {
        color: var(--st-vigente);
        font-weight: 800;
      }
      .sa-negative {
        color: var(--st-mismatch);
        font-weight: 800;
      }
      .sa-row-action {
        text-align: right;
      }
      .sa-row-failed {
        background: color-mix(in srgb, var(--st-mismatch) 6%, transparent);
      }
      .sa-icon {
        display: inline-flex;
        width: 20px;
        height: 20px;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        border-radius: 50%;
      }
      .sa-icon-ok {
        color: var(--st-vigente);
      }
      .sa-icon-nochange {
        color: var(--ink-muted);
      }
      .sa-icon-fail {
        color: var(--st-mismatch);
      }
      .sa-result-summary {
        border-top: var(--border-rule);
        padding-top: 14px;
      }
      .sa-result-title {
        font-weight: 800;
        margin: 0 0 10px;
        color: var(--ink);
      }
      .sa-result-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .sa-side {
        display: grid;
        gap: 16px;
      }
      .sa-csv-card {
        border: 1px solid var(--hairline);
        padding: 16px;
        display: grid;
        gap: 10px;
      }
      .sa-card-title {
        font-size: 14px;
        font-weight: 800;
        margin: 0;
        color: var(--ink);
      }
      .sa-csv-label input {
        width: 100%;
      }
      .sa-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .sa-error-bottom {
        margin-top: 12px;
      }
      .sa-footer {
        position: sticky;
        bottom: 0;
        background: var(--bg);
        border-top: var(--border-rule);
        padding: 14px var(--sp-8);
        margin: 20px calc(var(--sp-8) * -1) 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .sa-footer-summary {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sa-footer-actions {
        display: flex;
        gap: 10px;
      }

      @media (max-width: 1023px) {
        .sa-layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .sa-page {
          padding: var(--sp-4);
          padding-bottom: 90px;
        }
        .sa-footer {
          margin: 20px calc(var(--sp-4) * -1) 0;
          padding: 14px var(--sp-4);
        }
      }
    `,
  ],
})
export class StockAdjustmentPage {
  private inventorySvc = inject(InventoryAdminService);
  private productSvc = inject(ProductAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  protected modeOptions = MODE_OPTIONS;
  protected mode = signal<AdjustmentMode | ''>('');
  protected note = signal('');
  protected warehouseId = signal('');

  protected pickedProduct = signal<UiLookupItem | null>(null);
  protected pickedStock = signal<number | null>(null);
  protected draftQuantity = signal('');
  protected addLineError = signal('');

  protected lines = signal<DraftLine[]>([]);
  protected resultRows = signal<ResultRow[]>([]);

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  protected formError = signal('');
  protected submitted = signal(false);
  protected submitting = signal(false);
  protected lastResult = signal<BulkStockAdjustmentResult | null>(null);

  protected prefillNote = signal('');

  protected warehouseOptions = computed<UiFieldOption[]>(() =>
    this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  );
  protected warehouseName = computed(
    () => this.warehouses().find((w) => String(w.warehouseId) === this.warehouseId())?.name ?? '',
  );
  protected modeLabel = computed(
    () => this.modeOptions.find((o) => o.value === this.mode())?.label ?? '',
  );
  protected failedCount = computed(
    () => this.resultRows().filter((r) => r.state === 'failed').length,
  );

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return of<UiLookupItem[]>([]);
    return this.productSvc
      .list({ warehouseId, q, page: 0, size: 20 })
      .pipe(map((page) => (page.content ?? []).map(toProductLookup)));
  };

  protected previsto = (line: DraftLine) =>
    previstoText(this.mode() as AdjustmentMode, line.actualStock, line.quantity);

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const qpWarehouse = qp.get('warehouseId');
    const qpProductName = qp.get('productName');
    const qpProductCode = qp.get('productCode');
    if (qpProductCode) {
      this.prefillNote.set(
        `Viniste desde Stock por almacén para corregir ${qpProductName ?? qpProductCode} (${qpProductCode}). Búscalo abajo para agregarlo.`,
      );
    }

    this.inventorySvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        this.warehouseId.set(qpWarehouse || (list.length > 0 ? String(list[0].warehouseId) : ''));
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected onProductPicked(item: UiLookupItem) {
    this.pickedProduct.set(item);
    this.pickedStock.set(null);
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.productSvc.detail(item.id, warehouseId).subscribe((p) => this.pickedStock.set(p.stock));
  }

  protected addLine() {
    const warehouseId = Number(this.warehouseId());
    const quantity = Number(this.draftQuantity());
    const product = this.pickedProduct();
    const mode = this.mode();
    if (!warehouseId || !product) {
      this.addLineError.set('Elige el almacén y un producto.');
      return;
    }
    const minOk = mode === 'SET' ? quantity >= 0 : quantity > 0;
    if (this.draftQuantity() === '' || !minOk) {
      this.addLineError.set(
        mode === 'SET' ? 'La cantidad debe ser 0 o mayor.' : 'La cantidad debe ser mayor a 0.',
      );
      return;
    }
    const code = product.code ?? String(product.id);
    if (this.lines().some((l) => l.productCode === code)) {
      this.addLineError.set('Ese producto ya está en la lista.');
      return;
    }
    this.addLineError.set('');
    this.lines.update((rows) => [
      ...rows,
      {
        productCode: code,
        productName: product.name,
        warehouseId,
        quantity,
        actualStock: this.pickedStock(),
      },
    ]);
    this.pickedProduct.set(null);
    this.pickedStock.set(null);
    this.draftQuantity.set('');
  }

  protected removeLine(productCode: string) {
    this.lines.update((rows) => rows.filter((l) => l.productCode !== productCode));
  }

  protected clearLines() {
    this.lines.set([]);
  }

  protected onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const { lines: parsed, invalidRows } = parseStockCsv(text);
      const existingCodes = new Set(this.lines().map((l) => l.productCode));
      let duplicates = 0;
      const added: DraftLine[] = [];
      for (const p of parsed) {
        if (existingCodes.has(p.productCode)) {
          duplicates++;
          continue;
        }
        existingCodes.add(p.productCode);
        added.push({ ...p, productName: p.productCode, actualStock: null });
      }
      if (added.length === 0 && invalidRows === 0 && duplicates === 0) {
        this.formError.set('No pudimos leer líneas válidas del CSV.');
        return;
      }
      const notes: string[] = [];
      if (invalidRows > 0) notes.push(`${invalidRows} fila(s) inválida(s) omitida(s)`);
      if (duplicates > 0) notes.push(`${duplicates} producto(s) repetido(s) omitido(s)`);
      this.formError.set(notes.join(' · '));
      this.lines.update((rows) => [...rows, ...added]);
      input.value = '';
    });
  }

  protected downloadCsvTemplate = downloadCsvTemplate;

  protected confirmSubmit() {
    this.submitted.set(true);
    const mode = this.mode();
    if (!mode || this.lines().length === 0) {
      this.formError.set('Elige un modo y agrega al menos una línea.');
      return;
    }
    const n = this.lines().length;
    const warehouse = this.warehouseName();
    const message =
      mode === 'SET'
        ? `Se reemplazará el stock de ${n} producto${n === 1 ? '' : 's'} de ${warehouse} por las cantidades indicadas. ¿Aplicar?`
        : `Se ${mode === 'INCREASE' ? 'sumarán' : 'restarán'} cantidades a ${n} producto${n === 1 ? '' : 's'} de ${warehouse}. ¿Aplicar?`;
    this.dialog
      .confirm({ title: 'Confirmar ajuste', message, confirmLabel: 'Aplicar' })
      .subscribe((confirmed) => {
        if (confirmed) this.submit();
      });
  }

  private submit() {
    const mode = this.mode() as AdjustmentMode;
    const note = this.note().trim() || undefined;
    const draftByCode = new Map(this.lines().map((l) => [l.productCode, l]));
    const chunks: DraftLine[][] = [];
    for (let i = 0; i < this.lines().length; i += BATCH_SIZE) {
      chunks.push(this.lines().slice(i, i + BATCH_SIZE));
    }

    this.submitting.set(true);
    this.formError.set('');
    from(chunks)
      .pipe(
        concatMap((chunk, idx) =>
          this.inventorySvc
            .bulkStockAdjustment({
              mode,
              note,
              lines: chunk.map((l) => ({
                productCode: l.productCode,
                warehouseId: l.warehouseId,
                quantity: l.quantity,
              })),
            })
            .pipe(map((r) => ({ r, offset: idx * BATCH_SIZE }))),
        ),
        reduce(
          (acc, { r, offset }) => ({
            totalLines: acc.totalLines + r.totalLines,
            appliedCount: acc.appliedCount + r.appliedCount,
            lines: [
              ...acc.lines,
              ...r.lines.map((l) => ({ ...l, lineIndex: l.lineIndex + offset })),
            ],
          }),
          { totalLines: 0, appliedCount: 0, lines: [] } as BulkStockAdjustmentResult,
        ),
        catchError((err) => {
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.formError.set(
            detalle ? `No pudimos aplicar el ajuste: ${detalle}` : 'No pudimos aplicar el ajuste.',
          );
          return of(null);
        }),
      )
      .subscribe((result) => {
        this.submitting.set(false);
        if (!result) return;
        this.lastResult.set(result);
        const rows: ResultRow[] = result.lines.map((l) => {
          const draft = draftByCode.get(l.productCode) ?? {
            productCode: l.productCode,
            productName: l.productCode,
            warehouseId: l.warehouseId,
            quantity: 0,
            actualStock: null,
          };
          const state: ResultRow['state'] = !l.applied
            ? 'failed'
            : (l.appliedDelta ?? 0) === 0
              ? 'nochange'
              : 'applied';
          return { ...draft, state, appliedDelta: l.appliedDelta, errorReason: l.errorReason };
        });
        this.resultRows.set(rows);
        this.toast.success(`${result.appliedCount} de ${result.totalLines} líneas aplicadas`);
      });
  }

  protected correctFailed() {
    const failed = this.resultRows().filter((r) => r.state === 'failed');
    this.lines.set(
      failed.map((r) => ({
        productCode: r.productCode,
        productName: r.productName,
        warehouseId: r.warehouseId,
        quantity: r.quantity,
        actualStock: r.actualStock,
      })),
    );
    this.lastResult.set(null);
    this.resultRows.set([]);
  }

  protected reset() {
    this.lines.set([]);
    this.lastResult.set(null);
    this.resultRows.set([]);
    this.submitted.set(false);
    this.formError.set('');
    this.mode.set('');
    this.note.set('');
  }
}
