import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { InventoryModuleTabs } from './ui/module-tabs';
import { ReleaseAdvanceDialog, ReleaseAdvanceDialogData } from './ui/release-advance-dialog';
import { ReviewAdvancesDialog, ReviewAdvancesDialogData } from './ui/review-advances-dialog';
import {
  ImportAdvancesCsvDialog,
  ImportAdvancesCsvDialogData,
  ImportAdvancesCsvDialogResult,
} from './ui/import-advances-dialog';
import { InventoryAdminService } from './inventory-admin';
import { ProductAdminService } from '../catalog/product-admin';
import { ToastService } from '../../core/ui/toast';
import { AuthService } from '../../core/auth/auth';
import {
  CreateStockAdvancesResult,
  StockAdvanceLine,
  StockAdvanceView,
  WarehouseView,
} from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  advanceStatusLabel,
  advanceStatusTone,
  advanceWarningIcon,
  advanceWarningToneVar,
  downloadAdvancesCsvTemplate,
  parseAdvancesCsv,
  toProductLookup,
} from './inventory-format';

interface DraftLine extends StockAdvanceLine {
  productName: string;
  stock: number;
  pendingBefore: number;
}

const SHOW_OPTIONS: UiFieldOption[] = [
  { value: 'true', label: 'Abiertos' },
  { value: 'false', label: 'Todos' },
];

/**
 * Adelantos de stock — habilitar mercadería que está por llegar (doc 35,
 * sección 6). El formulario de creación y los botones Reducir/Anular solo se
 * muestran con `stock.advance`; con solo `report.view` la pantalla queda de
 * solo lectura.
 */
@Component({
  selector: 'app-stock-advances',
  imports: [RouterLink, UiButton, UiField, UiTypeahead, UiEmpty, UiInfoTip, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="sadv-page">
      <div class="sadv-head">
        <h1>Adelantos</h1>
        <p class="sadv-sub">
          Habilita stock que todavía no llegó para que se pueda vender desde ahora.
          <span
            uiInfoTip="Si el ERP ya registró la mercadería, no la adelantes: quedaría de más y nunca se cubre."
          ></span>
        </p>
      </div>

      <div class="sadv-layout">
        @if (canManage()) {
          <div class="sadv-form">
            <h2 class="sadv-card-title">Nuevo adelanto</h2>

            <ui-field
              label="Almacén"
              type="select"
              [(value)]="formWarehouseId"
              [options]="warehouseOptions()"
              [disabled]="loadingWarehouses()"
            />
            <ui-field
              label="Nota"
              [(value)]="note"
              hint="Obligatoria — qué mercadería se espera y de quién"
              [error]="submitted() && !note().trim() ? 'Obligatorio' : ''"
            />

            <ui-typeahead
              label="Buscar producto"
              placeholder="Código o nombre"
              [search]="productSearch"
              [selected]="pickedProduct()"
              (picked)="onProductPicked($event)"
            />
            @if (pickedProduct(); as p) {
              <p class="sadv-pick-hint">
                Stock actual: <strong>{{ pickedStock() }}</strong> · Ya adelantado:
                <strong>{{ pickedPending() }}</strong>
              </p>
            }
            <div class="sadv-add-row">
              <ui-field label="Cantidad" type="number" [(value)]="draftQuantity" />
              <button uiButton variant="secondary" (click)="addLine()">Agregar</button>
            </div>
            @if (addLineError()) {
              <div class="sadv-error">{{ addLineError() }}</div>
            }

            @if (lines().length > 0) {
              <div class="sadv-lines-head">
                <span class="sadv-lines-count"
                  >{{ lines().length }} producto{{ lines().length === 1 ? '' : 's' }} por
                  adelantar</span
                >
                <button type="button" class="sadv-clear-link" (click)="clearLines()">
                  Limpiar
                </button>
              </div>
              <table class="ui-table-grid sadv-lines-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>Adelantar</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines(); track line.productCode) {
                    <tr>
                      <td>
                        {{ line.productName }}
                        <div class="sadv-muted">{{ line.productCode }}</div>
                      </td>
                      <td class="sadv-num">{{ line.stock }}</td>
                      <td class="sadv-num">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          class="sadv-qty-input"
                          [value]="line.quantity"
                          (change)="updateLineQuantity(line.productCode, $event)"
                        />
                      </td>
                      <td class="sadv-row-action">
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
                    @if (line.pendingBefore > 0) {
                      <tr class="sadv-pending-note-row">
                        <td colspan="4" class="sadv-pending-note">
                          Ya hay {{ line.pendingBefore }} adelantados sin cubrir de este producto
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            }

            <div class="sadv-import-block">
              <div
                class="sadv-dropzone"
                [class.drag]="dragging()"
                [class.disabled]="!formWarehouseId()"
                (dragover)="onDragOver($event)"
                (dragleave)="dragging.set(false)"
                (drop)="onDrop($event)"
                (click)="formWarehouseId() && csvFileInput.click()"
              >
                <input
                  #csvFileInput
                  type="file"
                  accept=".csv,text/csv"
                  class="sadv-dropzone-input"
                  [disabled]="!formWarehouseId()"
                  (change)="onFileInputChange($event)"
                />
                <span class="material-icons sadv-dropzone-icon" aria-hidden="true"
                  >upload_file</span
                >
                <span>Arrastra el archivo aquí o <strong>elige un archivo</strong> (.csv)</span>
              </div>
              <button type="button" class="sadv-template-link" (click)="downloadTemplate()">
                Descargar plantilla
              </button>
              <p class="sadv-import-help">
                Una fila por producto: código y cantidad. El almacén y la nota se eligen arriba.
              </p>
              @if (csvError()) {
                <div class="sadv-error">{{ csvError() }}</div>
              }
            </div>

            @if (formError()) {
              <div class="sadv-error">{{ formError() }}</div>
            }

            <div class="sadv-submit">
              <button
                uiButton
                variant="primary"
                [loading]="previewing() || submitting()"
                [disabled]="lines().length === 0"
                (click)="confirmSubmit()"
              >
                {{
                  previewing()
                    ? 'Revisando…'
                    : submitting()
                      ? 'Adelantando…'
                      : 'Adelantar ' +
                        lines().length +
                        ' producto' +
                        (lines().length === 1 ? '' : 's')
                }}
              </button>
            </div>

            @if (lastResult(); as r) {
              <div class="sadv-result">
                <p class="sadv-result-title">
                  {{ r.appliedCount }} de {{ r.totalLines }} adelantados
                </p>
                @for (fail of failedLines(); track fail.productCode) {
                  <div class="sadv-fail-row">
                    <span class="sadv-cell-strong">{{ fail.productCode }}</span>
                    <span class="sadv-muted">{{ fail.errorReason }}</span>
                  </div>
                }
                @if (appliedWithWarnings().length > 0) {
                  <div class="sadv-warned">
                    <p class="sadv-warned-title">
                      Adelantados con aviso ({{ appliedWithWarnings().length }})
                    </p>
                    @for (w of appliedWithWarnings(); track w.productCode) {
                      <div class="sadv-warned-row">
                        <span class="sadv-cell-strong">{{ w.productCode }}</span>
                        @for (warn of w.warnings; track warn.code) {
                          <span
                            class="sadv-warned-msg"
                            [style.color]="'var(' + tone(warn.code) + ')'"
                            >{{ icon(warn.code) }} {{ warn.message }}</span
                          >
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        } @else {
          <ui-empty
            title="Sin permiso para crear adelantos"
            body="Puedes ver el listado, pero solo supervisión puede crear, reducir o anular adelantos."
          />
        }

        <div class="sadv-list">
          <div class="sadv-list-head">
            <h2 class="sadv-card-title">Adelantos</h2>
            <ui-field
              label="Mostrar"
              type="select"
              [(value)]="showMode"
              [options]="showOptions"
              class="sadv-show-select"
            />
          </div>

          <div class="sadv-filters">
            <ui-field
              label="Almacén"
              type="select"
              [(value)]="filterWarehouseId"
              [options]="filterWarehouseOptions()"
            />
            <ui-typeahead
              label="Producto"
              placeholder="Buscar por nombre"
              [clearOnPick]="false"
              [search]="productSearch"
              [(selected)]="filterProduct"
            />
            <ui-field label="Desde" type="date" [(value)]="filterFrom" />
            <ui-field label="Hasta" type="date" [(value)]="filterTo" />
          </div>

          <p class="sadv-count">{{ countText() }}</p>

          @if (loading()) {
            <div class="sadv-skeleton" role="status" aria-label="Cargando"></div>
          } @else if (error()) {
            <ui-empty
              variant="error"
              title="No pudimos cargar los adelantos"
              actionLabel="Reintentar"
              (action)="load()"
            />
          } @else if (rows().length === 0) {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              [title]="
                showMode() === 'true' ? 'No hay adelantos abiertos' : 'Sin adelantos registrados'
              "
            />
          } @else {
            @for (a of rows(); track a.advanceId) {
              <div class="sadv-row" [class.sadv-row-stale]="isStale(a)">
                <div class="sadv-row-main">
                  <div>
                    <span class="sadv-cell-strong"
                      >N.º {{ a.advanceId }} · {{ a.productName }}</span
                    >
                    <div class="sadv-muted">{{ a.warehouseName }}</div>
                  </div>
                  <span class="sadv-badge" [style.color]="toneVar(a)">{{ statusLabel(a) }}</span>
                </div>
                <div class="sadv-row-nums">
                  <span
                    >Adelantado <strong>{{ a.quantity }}</strong></span
                  >
                  <span
                    >Cubierto <strong>{{ a.coveredQuantity }}</strong></span
                  >
                  <span
                    >Retirado <strong>{{ a.releasedQuantity }}</strong></span
                  >
                  <span
                    class="sadv-pending-cell"
                    [class.sadv-pending-highlight]="a.pendingQuantity > 0"
                  >
                    Pendiente <strong>{{ a.pendingQuantity }}</strong>
                  </span>
                </div>
                <div class="sadv-muted">
                  {{ a.note }} · {{ a.createdByName }} · {{ dateTimeText(a.createdAt) }}
                </div>
                @if (a.lastUploadId) {
                  <a class="sadv-link" [routerLink]="['/inventario/cuadre', a.lastUploadId]">
                    Cubierto por la subida del ERP {{ a.lastUploadId }}
                  </a>
                }
                @if (a.open && canManage()) {
                  <div class="sadv-row-actions">
                    <button uiButton variant="secondary" size="sm" (click)="reduce(a)">
                      Reducir
                    </button>
                    <button uiButton variant="ghost" size="sm" (click)="release(a)">Anular</button>
                  </div>
                }
              </div>
            }

            <div class="sadv-pager">
              <button
                uiButton
                variant="secondary"
                size="sm"
                [disabled]="page() === 0"
                (click)="prevPage()"
              >
                Anterior
              </button>
              <span class="sadv-pager-label"
                >Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span
              >
              <button
                uiButton
                variant="secondary"
                size="sm"
                [disabled]="page() + 1 >= totalPages()"
                (click)="nextPage()"
              >
                Siguiente
              </button>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .sadv-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sadv-head {
        margin: 20px 0;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .sadv-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sadv-layout {
        display: grid;
        grid-template-columns: 360px 1fr;
        gap: 24px;
        align-items: start;
      }
      .sadv-form,
      .sadv-list {
        border: 1px solid var(--hairline);
        padding: 18px;
        display: grid;
        gap: 14px;
      }
      .sadv-card-title {
        font-size: 15px;
        font-weight: 800;
        margin: 0;
        color: var(--ink);
      }
      .sadv-pick-hint {
        margin: -6px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sadv-pick-hint strong {
        color: var(--ink);
      }
      .sadv-add-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
      }
      .sadv-lines-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .sadv-lines-count {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }
      .sadv-clear-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .sadv-lines-table {
        width: 100%;
      }
      .sadv-num {
        font-variant-numeric: var(--tnum);
        text-align: right;
      }
      .sadv-qty-input {
        width: 72px;
        font-family: var(--font-sans);
        font-size: 13px;
        text-align: right;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        padding: 4px 6px;
      }
      .sadv-pending-note-row td {
        padding: 0 0 8px;
        border: 0;
      }
      .sadv-pending-note {
        font-size: 12px;
        color: var(--st-in-route);
      }
      .sadv-import-block {
        display: grid;
        gap: 6px;
        border-top: var(--border-hair);
        padding-top: 14px;
      }
      .sadv-dropzone {
        position: relative;
        border: 2px dashed var(--divider);
        padding: 20px 14px;
        text-align: center;
        font-size: 12px;
        color: var(--ink-muted);
        cursor: pointer;
        display: grid;
        gap: 6px;
        justify-items: center;
      }
      .sadv-dropzone.drag {
        border-color: var(--accent);
        background: var(--faint);
      }
      .sadv-dropzone.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .sadv-dropzone-icon {
        font-size: 22px;
        color: var(--ink-muted);
      }
      .sadv-dropzone-input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .sadv-template-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        color: var(--accent-ink);
        font-size: 12px;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
        justify-self: start;
      }
      .sadv-import-help {
        margin: 0;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .sadv-submit {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .sadv-result {
        border-top: var(--border-rule);
        padding-top: 14px;
      }
      .sadv-result-title {
        font-weight: 800;
        margin: 0 0 8px;
        color: var(--ink);
      }
      .sadv-warned {
        margin-top: 12px;
        padding-top: 12px;
        border-top: var(--border-hair);
      }
      .sadv-warned-title {
        font-weight: 800;
        font-size: 13px;
        margin: 0 0 8px;
        color: var(--ink);
      }
      .sadv-warned-row {
        display: grid;
        gap: 2px;
        padding: 6px 0;
        border-bottom: 1px solid var(--hairline);
      }
      .sadv-warned-msg {
        display: block;
        font-size: 12px;
      }
      .sadv-fail-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;
        padding: 6px 0;
        border-bottom: 1px solid var(--hairline);
      }
      .sadv-cell-strong {
        font-weight: 800;
        color: var(--ink);
      }
      .sadv-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sadv-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .sadv-row-action {
        text-align: right;
      }
      .sadv-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .sadv-list-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
      }
      .sadv-show-select {
        width: 140px;
      }
      .sadv-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 14px;
        border-bottom: var(--border-hair);
      }
      .sadv-count {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sadv-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .sadv-row {
        border: 1px solid var(--hairline);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .sadv-row-stale {
        border-left: 3px solid var(--st-in-route);
      }
      .sadv-row-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .sadv-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .sadv-row-nums {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sadv-row-nums strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .sadv-pending-highlight strong {
        color: var(--st-in-route);
      }
      .sadv-link {
        font-size: 12px;
        color: var(--accent-ink);
      }
      .sadv-row-actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }
      .sadv-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 8px;
      }
      .sadv-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 1023px) {
        .sadv-layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .sadv-page {
          padding: var(--sp-4);
        }
        .sadv-filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StockAdvancesPage {
  private inventorySvc = inject(InventoryAdminService);
  private productSvc = inject(ProductAdminService);
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  protected dateTimeText = dateTimeText;
  protected showOptions = SHOW_OPTIONS;
  protected statusLabel = (a: StockAdvanceView) => advanceStatusLabel(a.statusCode);
  protected toneVar = (a: StockAdvanceView) =>
    `var(${BADGE_TONE_VAR[advanceStatusTone(a.statusCode)]})`;
  protected icon = advanceWarningIcon;
  protected tone = advanceWarningToneVar;

  protected canManage = computed(() => this.auth.hasAny('stock.advance'));

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  // Formulario
  protected formWarehouseId = signal('');
  protected note = signal('');
  protected pickedProduct = signal<UiLookupItem | null>(null);
  protected pickedStock = signal(0);
  protected pickedPending = signal(0);
  protected draftQuantity = signal('');
  protected lines = signal<DraftLine[]>([]);
  protected addLineError = signal('');
  protected formError = signal('');
  protected submitted = signal(false);
  protected previewing = signal(false);
  protected submitting = signal(false);
  protected lastResult = signal<CreateStockAdvancesResult | null>(null);
  protected dragging = signal(false);
  protected csvError = signal('');

  // Listado
  protected showMode = signal('true');
  protected filterWarehouseId = signal('');
  protected filterProduct = signal<UiLookupItem | null>(null);
  protected filterFrom = signal('');
  protected filterTo = signal('');
  protected rows = signal<StockAdvanceView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const warehouseId = Number(this.formWarehouseId() || this.filterWarehouseId());
    if (!warehouseId) return of<UiLookupItem[]>([]);
    return this.productSvc
      .list({ warehouseId, q, page: 0, size: 20 })
      .pipe(map((page) => (page.content ?? []).map(toProductLookup)));
  };

  protected warehouseOptions = computed<UiFieldOption[]>(() =>
    this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  );
  protected filterWarehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  private filtersEffect = effect(() => {
    this.showMode();
    this.filterWarehouseId();
    this.filterProduct();
    this.filterFrom();
    this.filterTo();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  constructor() {
    const qpWarehouse = this.route.snapshot.queryParamMap.get('warehouseId');
    const qpProductId = this.route.snapshot.queryParamMap.get('productId');
    if (qpWarehouse) this.filterWarehouseId.set(qpWarehouse);
    if (qpProductId) {
      this.filterProduct.set({ id: Number(qpProductId), name: `Producto #${qpProductId}` });
      this.showMode.set('false'); // viene a revisar un producto puntual: no ocultar lo ya cerrado
    }

    this.inventorySvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        this.formWarehouseId.set(
          qpWarehouse || (list.length > 0 ? String(list[0].warehouseId) : ''),
        );
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected countText(): string {
    const n = this.totalElements();
    const suffix = this.showMode() === 'true' ? 'abiertos' : 'registrados';
    return n === 1 ? `1 adelanto ${suffix}` : `${n} adelantos ${suffix}`;
  }

  protected isStale(a: StockAdvanceView): boolean {
    if (!a.open) return false;
    const days = (Date.now() - new Date(a.createdAt).getTime()) / 86400000;
    return days >= 3;
  }

  protected onProductPicked(item: UiLookupItem) {
    this.pickedProduct.set(item);
    const warehouseId = Number(this.formWarehouseId());
    if (!warehouseId) return;
    this.productSvc.detail(item.id, warehouseId).subscribe((p) => this.pickedStock.set(p.stock));
    this.inventorySvc
      .stockAdvances({ warehouseId, productId: item.id, onlyOpen: true, size: 100 })
      .subscribe((page) => {
        const sum = (page.content ?? []).reduce((acc, a) => acc + a.pendingQuantity, 0);
        this.pickedPending.set(sum);
      });
  }

  protected addLine() {
    const warehouseId = Number(this.formWarehouseId());
    const quantity = Number(this.draftQuantity());
    const product = this.pickedProduct();
    if (!warehouseId || !product || !quantity || quantity <= 0) {
      this.addLineError.set('Elige un producto y una cantidad mayor a 0.');
      return;
    }
    this.addLineError.set('');
    const code = product.code ?? String(product.id);
    this.lines.update((rows) => {
      const existing = rows.find((l) => l.productCode === code && l.warehouseId === warehouseId);
      if (existing) {
        this.toast.info('Se sumó a la línea existente');
        return rows.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [
        ...rows,
        {
          productCode: code,
          productName: product.name,
          stock: this.pickedStock(),
          warehouseId,
          quantity,
          pendingBefore: this.pickedPending(),
        },
      ];
    });
    this.pickedProduct.set(null);
    this.pickedStock.set(0);
    this.pickedPending.set(0);
    this.draftQuantity.set('');
  }

  protected updateLineQuantity(productCode: string, ev: Event) {
    const value = Number((ev.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.lines.update((rows) =>
      rows.map((l) => (l.productCode === productCode ? { ...l, quantity: value } : l)),
    );
  }

  protected removeLine(productCode: string) {
    this.lines.update((rows) => rows.filter((l) => l.productCode !== productCode));
  }

  protected clearLines() {
    this.lines.set([]);
    this.lastResult.set(null);
  }

  protected downloadTemplate() {
    downloadAdvancesCsvTemplate();
  }

  protected onDragOver(ev: DragEvent) {
    if (!this.formWarehouseId()) return;
    ev.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    if (!this.formWarehouseId()) return;
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.handleCsvFile(f);
  }

  protected onFileInputChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.handleCsvFile(f);
    input.value = '';
  }

  private handleCsvFile(file: File) {
    this.csvError.set('');
    const warehouseId = Number(this.formWarehouseId());
    const warehouseName = this.warehouses().find((w) => w.warehouseId === warehouseId)?.name ?? '';
    if (!warehouseId) return;
    file.text().then((text) => {
      const parsed = parseAdvancesCsv(text);
      if (parsed.error) {
        this.csvError.set(parsed.error);
        return;
      }
      this.dialog
        .open<
          ImportAdvancesCsvDialog,
          ImportAdvancesCsvDialogData,
          ImportAdvancesCsvDialogResult | null
        >(ImportAdvancesCsvDialog, {
          data: { warehouseId, warehouseName, fileName: file.name, parsed },
          width: '860px',
        })
        .afterClosed()
        .subscribe((result) => {
          if (result) this.mergeImportedLines(result.lines, warehouseId);
        });
    });
  }

  private mergeImportedLines(
    imported: {
      productCode: string;
      productName: string;
      quantity: number;
      pendingBefore: number;
    }[],
    warehouseId: number,
  ) {
    if (imported.length === 0) return;
    let merged = 0;
    this.lines.update((rows) => {
      let next = [...rows];
      for (const line of imported) {
        const existingIndex = next.findIndex(
          (l) => l.productCode === line.productCode && l.warehouseId === warehouseId,
        );
        if (existingIndex >= 0) {
          next = next.map((l, i) =>
            i === existingIndex ? { ...l, quantity: l.quantity + line.quantity } : l,
          );
          merged++;
        } else {
          next.push({
            productCode: line.productCode,
            productName: line.productName,
            stock: 0,
            warehouseId,
            quantity: line.quantity,
            pendingBefore: line.pendingBefore,
          });
        }
      }
      return next;
    });
    if (merged > 0) this.toast.info('Se sumó a la línea existente');
  }

  protected failedLines() {
    const result = this.lastResult();
    if (!result) return [];
    return result.lines
      .filter((l) => !l.applied)
      .map((l) => ({ productCode: l.productCode, errorReason: l.errorReason }));
  }

  protected appliedWithWarnings() {
    const result = this.lastResult();
    if (!result) return [];
    return result.lines.filter((l) => l.applied && l.warnings.length > 0);
  }

  /**
   * Siempre revisa antes de crear (doc 69, sección 5.1): sin avisos ni
   * filas inválidas se crea directo; si hay algo que revisar, se abre el
   * modal "Revisar antes de adelantar" y ahí decide qué sigue.
   */
  protected confirmSubmit() {
    this.submitted.set(true);
    if (!this.note().trim() || this.lines().length === 0) {
      this.formError.set('La nota y al menos una línea son obligatorias.');
      return;
    }
    this.formError.set('');
    const draftLines = this.lines();
    const cmdLines: StockAdvanceLine[] = draftLines.map((l) => ({
      productCode: l.productCode,
      warehouseId: l.warehouseId,
      quantity: l.quantity,
    }));

    this.previewing.set(true);
    this.inventorySvc.previewStockAdvances({ lines: cmdLines }).subscribe({
      next: (preview) => {
        this.previewing.set(false);
        if (preview.linesWithWarnings === 0 && preview.invalidLines === 0) {
          this.submit(cmdLines);
          return;
        }
        this.dialog
          .open<ReviewAdvancesDialog, ReviewAdvancesDialogData, StockAdvanceLine[] | null>(
            ReviewAdvancesDialog,
            {
              data: {
                lines: draftLines.map((l) => ({
                  productCode: l.productCode,
                  productName: l.productName,
                  warehouseId: l.warehouseId,
                  quantity: l.quantity,
                })),
                preview,
              },
              width: '640px',
            },
          )
          .afterClosed()
          .subscribe((finalLines) => {
            if (finalLines && finalLines.length > 0) this.submit(finalLines);
          });
      },
      error: () => {
        this.previewing.set(false);
        this.toast.error('No se pudo revisar el adelanto. Inténtalo de nuevo.');
      },
    });
  }

  private submit(cmdLines: StockAdvanceLine[]) {
    this.submitting.set(true);
    this.formError.set('');
    this.inventorySvc.createStockAdvances({ note: this.note().trim(), lines: cmdLines }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.lastResult.set(result);
        this.toast.success(`${result.appliedCount} productos adelantados`);
        const appliedCodes = new Set(
          result.lines.filter((l) => l.applied).map((l) => l.productCode),
        );
        this.lines.update((rows) => rows.filter((l) => !appliedCodes.has(l.productCode)));
        if (this.lines().length === 0) this.note.set('');
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.formError.set(detalle || 'No pudimos crear el adelanto.');
      },
    });
  }

  protected reduce(a: StockAdvanceView) {
    this.openRelease(a, 'reduce');
  }
  protected release(a: StockAdvanceView) {
    this.openRelease(a, 'release');
  }

  private openRelease(a: StockAdvanceView, mode: 'release' | 'reduce') {
    this.dialog
      .open<ReleaseAdvanceDialog, ReleaseAdvanceDialogData, StockAdvanceView | false>(
        ReleaseAdvanceDialog,
        { data: { advance: a, mode }, width: '440px' },
      )
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) return;
        this.rows.update((rows) =>
          rows.map((r) => (r.advanceId === updated.advanceId ? updated : r)),
        );
        this.toast.success('Adelanto actualizado');
      });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc
      .stockAdvances({
        warehouseId: this.filterWarehouseId() ? Number(this.filterWarehouseId()) : undefined,
        productId: this.filterProduct()?.id,
        onlyOpen: this.showMode() === 'true',
        from: this.filterFrom() || undefined,
        to: this.filterTo() || undefined,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.totalElements.set(result.totalElements ?? 0);
          this.totalPages.set(result.totalPages ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
}
