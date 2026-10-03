import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { SalesReportAdminService } from './sales-report-admin';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { CounterSessionStore } from '../orders/counter-session-store';
import { WarehouseView } from '../../shared/models/inventory.models';
import { SalesStockReport } from '../../shared/models/sales-report.models';
import { quantityText } from './sales-report-format';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ventas con stock ("negativos") — GET /orders/reports/sales-stock, nuevo
 * en doc 30, sección 11.3: cruza lo vendido contra el stock del sistema
 * para detectar ventas que no se pudieron descontar. Las columnas de ERP
 * quedan atenuadas hasta que exista esa conexión (erpStockAvailable).
 */
@Component({
  selector: 'app-sales-stock-tab',
  imports: [UiField, UiToggle, UiEmpty, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="sks-page">
      <div class="sks-toolbar">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="warehouseId"
          [options]="warehouseOptions()"
          [disabled]="loadingWarehouses()"
        />
        <ui-field label="Desde" type="date" [(value)]="from" />
        <ui-field label="Hasta" type="date" [(value)]="to" hint='Máximo 31 días desde "Desde"' />
        <ui-toggle label="Solo con problema" [(checked)]="onlyIssues" class="sks-toggle" />
      </div>

      @if (!warehouseId()) {
        <ui-empty
          title="Elige un almacén"
          body="Selecciona el almacén para cruzar sus ventas contra el stock."
        />
      } @else if (loading()) {
        <div class="sks-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el reporte"
          body="{{ error() }}"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        <div class="sks-indicator-row">
          <div class="sks-indicator">
            <span class="sks-indicator-value">{{ r.productCount }}</span>
            <span class="sks-indicator-label">Productos revisados</span>
          </div>
          <div class="sks-indicator" [class.sks-indicator-warn]="r.productsWithPending > 0">
            <span class="sks-indicator-value">{{ r.productsWithPending }}</span>
            <span class="sks-indicator-label">Con venta sin stock</span>
          </div>
        </div>

        @if (!r.erpStockAvailable) {
          <p class="sks-erp-note">
            Conexión con el ERP pendiente: las columnas "Stock ERP" y "Diferencia" se habilitarán
            cuando esté disponible.
          </p>
        }

        @if (r.rows.length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Sin diferencias"
            body="Todo lo vendido en este almacén se descontó correctamente del stock."
          />
        } @else {
          <div class="sks-table-wrap">
            <table class="ui-table-grid sks-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>UM</th>
                  <th>Vendido</th>
                  <th>Pendiente</th>
                  <th>Stock sistema</th>
                  <th>Stock esperado</th>
                  <th [class.sks-dim]="!r.erpStockAvailable">Stock ERP</th>
                  <th [class.sks-dim]="!r.erpStockAvailable">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                @for (row of r.rows; track row.productId) {
                  <tr [class.sks-row-issue]="row.pendingQuantity > 0">
                    <td class="sks-muted">{{ row.productCode }}</td>
                    <td>{{ row.productName }}</td>
                    <td class="sks-muted">{{ row.unitOfMeasure }}</td>
                    <td class="sks-muted">{{ quantityText(row.soldQuantity) }}</td>
                    <td [class.sks-pending]="row.pendingQuantity > 0">
                      {{ quantityText(row.pendingQuantity) }}
                    </td>
                    <td class="sks-muted">{{ quantityText(row.systemStock) }}</td>
                    <td class="sks-muted">{{ quantityText(row.expectedErpStock) }}</td>
                    <td [class.sks-dim]="!r.erpStockAvailable">
                      {{ row.erpStock != null ? quantityText(row.erpStock) : '—' }}
                    </td>
                    <td [class.sks-dim]="!r.erpStockAvailable">
                      {{ row.difference != null ? quantityText(row.difference) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .sks-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sks-toolbar {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .sks-toolbar ui-field {
        width: 200px;
      }
      .sks-toggle {
        min-width: 220px;
      }
      .sks-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .sks-indicator-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }
      .sks-indicator {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .sks-indicator-warn {
        border-color: var(--st-no-purchase);
      }
      .sks-indicator-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .sks-indicator-warn .sks-indicator-value {
        color: var(--st-no-purchase);
      }
      .sks-indicator-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sks-erp-note {
        font-size: 12px;
        color: var(--ink-muted);
        border-left: 3px solid var(--divider);
        padding: 8px 12px;
        margin: 0 0 16px;
      }
      .sks-table-wrap {
        overflow-x: auto;
      }
      .sks-table {
        width: 100%;
      }
      .sks-muted {
        color: var(--ink-muted);
        font-size: 13px;
        white-space: nowrap;
      }
      .sks-pending {
        font-weight: 800;
        color: var(--st-no-purchase);
      }
      .sks-row-issue {
        background: color-mix(in srgb, var(--st-no-purchase) 8%, transparent);
      }
      .sks-dim {
        opacity: 0.4;
      }

      @media (max-width: 767px) {
        .sks-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class SalesStockTab {
  private reportSvc = inject(SalesReportAdminService);
  private catalogSvc = inject(CatalogLookupService);
  protected counterSession = inject(CounterSessionStore);

  protected quantityText = quantityText;

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);
  protected warehouseId = signal('');
  protected from = signal(todayIso());
  protected to = signal(todayIso());
  protected onlyIssues = signal(true);

  protected report = signal<SalesStockReport | null>(null);
  protected loading = signal(false);
  protected error = signal('');

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingWarehouses() ? 'Cargando…' : 'Selecciona un almacén' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  private loadEffect = effect(() => {
    this.warehouseId();
    this.from();
    this.to();
    this.onlyIssues();
    untracked(() => {
      if (this.warehouseId()) this.load();
    });
  });

  constructor() {
    this.counterSession.ensureLoaded();
    this.catalogSvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        const ownId = this.counterSession.warehouseId();
        if (ownId && list.some((w) => w.warehouseId === ownId)) {
          this.warehouseId.set(String(ownId));
        }
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  load() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.loading.set(true);
    this.error.set('');
    this.reportSvc.salesStock(warehouseId, this.from(), this.to(), this.onlyIssues()).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(detalle || 'No pudimos cargar el reporte de stock.');
      },
    });
  }
}
