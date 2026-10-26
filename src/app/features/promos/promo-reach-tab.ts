import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { format, parseISO } from 'date-fns';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiCard } from '../../shared/ui/card/card';
import { UiStatus } from '../../shared/ui/status/status';
import { UiButton } from '../../shared/ui/button/button';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { PromoService } from './promo';
import { dateText, choiceStatusLabel } from './promo-format';
import { orderStatusName } from '../orders/order-format';
import { quantityText } from '../sales-reports/sales-report-format';
import { formatSoles } from '../../shared/pipes/money';
import {
  PromoReachOrderRow,
  PromoReachView,
  ReachChoiceStatus,
  ReachSalespersonRow,
} from './promo-reach.models';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ExportColumn, ExportFormat, ExportTable } from '../../shared/utils/export/export.models';
import { exportFileName } from '../../shared/utils/export/export-file-name';
import { PromoChoiceDialog, PromoChoiceDialogResult } from './ui/promo-choice-dialog';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fecha `dd/MM HH:mm` — doc 47, sección 10.3 (la tabla de pedidos no repite el año). */
function shortDateTime(value: string): string {
  return format(parseISO(value), 'dd/MM HH:mm');
}

const CHOICE_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'CHOSEN', label: 'Elegido' },
  { value: 'PENDING', label: 'Por elegir' },
  { value: 'DECLINED', label: 'No otorgado' },
];

/**
 * Pestaña "Alcance" del detalle de la promoción — doc 47, sección 10.
 * Autosuficiente: carga el resumen y los pedidos, maneja sus propios
 * filtros (rango, vendedor, premio) y la paginación, y permite resolver un
 * premio pendiente directo desde la tabla.
 */
@Component({
  selector: 'app-promo-reach-tab',
  imports: [UiField, UiCard, UiStatus, UiButton, UiExportMenu, HasPermissionDirective],
  template: `
    <div class="prt-filters">
      <ui-field label="Desde" type="date" [(value)]="from" (valueChange)="onRangeChange()" />
      <ui-field label="Hasta" type="date" [(value)]="to" (valueChange)="onRangeChange()" />
      <ui-field
        label="Vendedor"
        type="select"
        [(value)]="salespersonFilter"
        [options]="salespersonOptions()"
        (valueChange)="reload()"
      />
      <span class="prt-range-hint">Desde la vigencia de la promoción</span>
    </div>

    @if (reachLoading()) {
      <div class="prt-skeleton" role="status" aria-label="Cargando"></div>
    } @else if (reachError()) {
      <div class="prt-error">
        No pudimos cargar el alcance. <button type="button" (click)="reload()">Reintentar</button>
      </div>
    } @else if (reach(); as r) {
      <div class="prt-usage">
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Pedidos</span>
          <span class="prt-usage-value">{{ r.totals.orderCount }}</span>
        </div>
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Clientes</span>
          <span class="prt-usage-value">{{ r.totals.customerCount }}</span>
        </div>
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Descuento total</span>
          <span class="prt-usage-value">{{ formatSoles(r.totals.discountAmount) }}</span>
        </div>
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Promedio por pedido</span>
          <span class="prt-usage-value">{{ formatSoles(r.totals.averageDiscountPerOrder) }}</span>
          <span class="prt-usage-caption">entre los pedidos con descuento</span>
        </div>
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Unidades bonificadas</span>
          <span class="prt-usage-value">{{ quantityText(r.totals.bonusUnits) }}</span>
        </div>
        <div class="prt-usage-cell">
          <span class="prt-usage-label">Por elegir · No otorgados</span>
          @if (r.totals.pendingChoices > 0) {
            <button type="button" class="prt-usage-link" (click)="filterPending()">
              {{ r.totals.pendingChoices }} · {{ r.totals.declinedChoices }}
            </button>
          } @else {
            <span class="prt-usage-value"
              >{{ r.totals.pendingChoices }} · {{ r.totals.declinedChoices }}</span
            >
          }
        </div>
      </div>

      <div class="prt-side-grid">
        @if (r.byTier.length > 1) {
          <ui-card title="Por tramo">
            <div class="prt-tier-rows">
              @for (t of r.byTier; track t.tier) {
                <div class="prt-tier-row">
                  <span>Tramo {{ t.tier }} · {{ t.thresholdText }}</span>
                  <span class="prt-tnum">{{ t.orderCount }}</span>
                </div>
              }
            </div>
          </ui-card>
        }
        <ui-card title="Por vendedor">
          @if (!r.bySalesperson.length) {
            <p class="prt-empty-text">Sin pedidos de ningún vendedor en el rango.</p>
          } @else {
            <table class="ui-table-grid prt-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Vendedor</th>
                  <th class="prt-col-right">Pedidos</th>
                  <th class="prt-col-right">Descuento</th>
                </tr>
              </thead>
              <tbody>
                @for (s of r.bySalesperson; track s.salespersonId) {
                  <tr class="prt-row-clickable" (click)="filterBySalesperson(s)">
                    <td class="prt-muted">{{ s.salespersonCode }}</td>
                    <td>{{ s.salespersonName }}</td>
                    <td class="prt-col-right">{{ s.orderCount }}</td>
                    <td class="prt-col-right">{{ formatSoles(s.discountAmount) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </ui-card>
        @if (r.bonusProducts.length) {
          <ui-card title="Productos bonificados">
            <table class="ui-table-grid prt-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th class="prt-col-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                @for (p of r.bonusProducts; track p.productId) {
                  <tr>
                    <td class="prt-muted">{{ p.productCode }}</td>
                    <td>{{ p.productName }}</td>
                    <td class="prt-col-right">{{ quantityText(p.units) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </ui-card>
        }
      </div>

      <div class="prt-orders-head">
        <h3>Pedidos</h3>
        <div class="prt-orders-actions">
          @if (hasChoiceColumn()) {
            <ui-field
              label="Premio"
              type="select"
              [(value)]="choiceStatusFilter"
              [options]="choiceOptions"
              (valueChange)="reloadOrders()"
            />
          }
          <ui-export-menu
            [disabled]="orders().length === 0"
            [busy]="exporting()"
            (export)="exportOrders($event)"
          />
        </div>
      </div>

      @if (ordersLoading()) {
        <div class="prt-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (ordersError()) {
        <div class="prt-error">
          No pudimos cargar los pedidos.
          <button type="button" (click)="reloadOrders()">Reintentar</button>
        </div>
      } @else if (orders().length === 0) {
        <p class="prt-empty-text">Esta promoción no tuvo pedidos en el rango elegido.</p>
      } @else {
        <table class="ui-table-grid prt-table prt-orders-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Tramo</th>
              @if (hasDiscountColumn()) {
                <th class="prt-col-right">Descuento</th>
              }
              @if (hasUnitsColumn()) {
                <th class="prt-col-right">Unid.</th>
              }
              <th>Estado</th>
              @if (hasChoiceColumn()) {
                <th>Premio</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.orderId) {
              <tr class="prt-row-clickable" (click)="openOrder(o)">
                <td class="prt-muted">{{ shortDateTime(o.orderDate) }}</td>
                <td class="prt-muted">{{ o.orderId }}</td>
                <td>
                  <span class="prt-muted">{{ o.customerCode }}</span>
                  {{ o.customerName }}
                </td>
                <td>
                  <span class="prt-muted">{{ o.salespersonCode }}</span>
                  {{ o.salespersonName }}
                </td>
                <td>Tramo {{ o.tier }}</td>
                @if (hasDiscountColumn()) {
                  <td class="prt-col-right">
                    {{ o.discountAmount ? formatSoles(o.discountAmount) : '—' }}
                  </td>
                }
                @if (hasUnitsColumn()) {
                  <td class="prt-col-right">
                    {{ o.bonusUnits ? quantityText(o.bonusUnits) : '—' }}
                  </td>
                }
                <td><ui-status [label]="orderStatusName(o.orderStatusCode)" /></td>
                @if (hasChoiceColumn()) {
                  <td (click)="$event.stopPropagation()">
                    @if (o.choiceStatus === 'PENDING' && o.pendingApplicationId) {
                      <button
                        type="button"
                        uiButton
                        variant="secondary"
                        size="sm"
                        *hasPermission="'promo.resolve_choice'"
                        (click)="resolve(o)"
                      >
                        Resolver
                      </button>
                    } @else if (o.choiceStatus) {
                      <ui-status [label]="choiceStatusLabel(o.choiceStatus)" />
                    } @else {
                      —
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <div class="prt-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="prt-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
    }
  `,
  styles: [
    `
      :host {
        display: block;
        margin-top: var(--sp-5);
      }
      .prt-filters {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-4);
        flex-wrap: wrap;
        margin-bottom: var(--sp-5);
      }
      .prt-filters ui-field {
        width: 180px;
      }
      .prt-range-hint {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        margin-bottom: 10px;
      }
      .prt-skeleton {
        height: 160px;
        background: var(--faint);
      }
      .prt-error {
        padding: var(--sp-4);
        border: 1px solid var(--hairline);
        color: var(--status-danger);
        font-size: var(--fs-dense);
      }
      .prt-error button {
        margin-left: var(--sp-2);
        color: var(--accent-ink);
        font-weight: 700;
        background: none;
        border: none;
        cursor: pointer;
      }
      .prt-usage {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        background: var(--surface);
        border: 2px solid var(--divider);
        border-radius: var(--radius-card);
        margin-bottom: var(--sp-5);
      }
      .prt-usage-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--sp-4);
        border-right: 1px solid var(--hairline);
      }
      .prt-usage-cell:last-child {
        border-right: 0;
      }
      .prt-usage-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        order: -1;
      }
      .prt-usage-value {
        font-size: var(--fs-h2);
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .prt-usage-link {
        align-self: flex-start;
        font-size: var(--fs-h2);
        font-weight: 800;
        color: var(--accent-ink);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-variant-numeric: var(--tnum);
      }
      .prt-usage-caption {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .prt-side-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: var(--sp-5);
        margin-bottom: var(--sp-6);
        align-items: start;
      }
      .prt-tier-rows {
        display: grid;
        gap: var(--sp-2);
      }
      .prt-tier-row {
        display: flex;
        justify-content: space-between;
        font-size: var(--fs-dense);
      }
      .prt-table {
        width: 100%;
      }
      .prt-muted {
        color: var(--ink-muted);
      }
      .prt-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .prt-row-clickable {
        cursor: pointer;
      }
      .prt-row-clickable:hover {
        background: var(--faint);
      }
      .prt-empty-text {
        color: var(--ink-muted);
        font-size: var(--fs-body);
      }
      .prt-orders-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
        margin-bottom: var(--sp-3);
        flex-wrap: wrap;
      }
      .prt-orders-head h3 {
        margin: 0;
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .prt-orders-actions {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-3);
      }
      .prt-orders-actions ui-field {
        width: 160px;
      }
      .prt-pager {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
      }
      .prt-pager-label {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .prt-filters ui-field {
          width: 100%;
        }
      }
    `,
  ],
})
export class PromoReachTab {
  private promoSvc = inject(PromoService);
  private router = inject(Router);
  private dialog = inject(UiDialogService);
  private exporter = inject(TableExporter);

  promoId = input.required<number>();
  /** Rango inicial — doc 47, sección 11.2: llega desde "Comparar promociones" con el mismo rango. */
  initialFrom = input<string | null>(null);
  initialTo = input<string | null>(null);

  protected formatSoles = formatSoles;
  protected quantityText = quantityText;
  protected dateText = dateText;
  protected shortDateTime = shortDateTime;
  protected orderStatusName = orderStatusName;
  protected choiceStatusLabel = choiceStatusLabel;
  protected choiceOptions = CHOICE_FILTER_OPTIONS;

  protected from = signal('');
  protected to = signal('');
  protected salespersonFilter = signal('');
  protected choiceStatusFilter = signal<ReachChoiceStatus | ''>('');

  protected reach = signal<PromoReachView | null>(null);
  protected reachLoading = signal(true);
  protected reachError = signal(false);
  private allSalespeople = signal<ReachSalespersonRow[]>([]);

  protected orders = signal<PromoReachOrderRow[]>([]);
  protected ordersLoading = signal(true);
  protected ordersError = signal(false);
  protected page = signal(0);
  protected totalPages = signal(0);
  protected exporting = signal(false);

  protected salespersonOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos los vendedores' },
    ...this.allSalespeople().map((s) => ({
      value: String(s.salespersonId),
      label: s.salespersonName,
    })),
  ]);

  protected hasDiscountColumn = computed(() => (this.reach()?.totals.discountOrderCount ?? 0) > 0);
  protected hasUnitsColumn = computed(
    () =>
      (this.reach()?.totals.bonusUnits ?? 0) > 0 || (this.reach()?.bonusProducts.length ?? 0) > 0,
  );
  protected hasChoiceColumn = computed(() => {
    const r = this.reach();
    if (!r) return false;
    return (
      r.totals.pendingChoices > 0 ||
      r.totals.declinedChoices > 0 ||
      this.orders().some((o) => o.choiceStatus != null)
    );
  });

  constructor() {
    if (this.initialFrom()) this.from.set(this.initialFrom()!);
    if (this.initialTo()) this.to.set(this.initialTo()!);
    this.reload();
  }

  protected onRangeChange() {
    this.reload();
  }

  /** Primera carga (o cambio de rango/vendedor): resumen primero, luego pedidos. */
  reload() {
    this.reachLoading.set(true);
    this.reachError.set(false);
    const firstLoad = !this.from() && !this.to();
    this.promoSvc
      .reach(this.promoId(), {
        from: this.from() || undefined,
        to: this.to() || undefined,
        salespersonId: this.salespersonFilter() ? Number(this.salespersonFilter()) : undefined,
      })
      .subscribe({
        next: (r) => {
          this.reach.set(r);
          this.reachLoading.set(false);
          if (firstLoad) {
            this.from.set(r.from);
            this.to.set(r.to);
          }
          if (!this.salespersonFilter()) this.allSalespeople.set(r.bySalesperson);
          this.reloadOrders();
        },
        error: () => {
          this.reachLoading.set(false);
          this.reachError.set(true);
        },
      });
  }

  protected reloadOrders() {
    this.page.set(0);
    this.loadOrdersPage();
  }

  private loadOrdersPage() {
    this.ordersLoading.set(true);
    this.ordersError.set(false);
    this.promoSvc
      .reachOrders(this.promoId(), {
        from: this.from() || undefined,
        to: this.to() || undefined,
        salespersonId: this.salespersonFilter() ? Number(this.salespersonFilter()) : undefined,
        choiceStatus: (this.choiceStatusFilter() || undefined) as ReachChoiceStatus | undefined,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.content ?? []);
          this.totalPages.set(res.totalPages ?? 0);
          this.ordersLoading.set(false);
        },
        error: () => {
          this.ordersLoading.set(false);
          this.ordersError.set(true);
        },
      });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.loadOrdersPage();
  }

  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.loadOrdersPage();
  }

  protected filterBySalesperson(s: ReachSalespersonRow) {
    this.salespersonFilter.set(String(s.salespersonId));
    this.reload();
  }

  protected filterPending() {
    this.choiceStatusFilter.set('PENDING');
    this.reloadOrders();
  }

  protected openOrder(o: PromoReachOrderRow) {
    this.router.navigate(['/pedidos/detalle', o.orderId]);
  }

  protected resolve(o: PromoReachOrderRow) {
    this.promoSvc.pendingChoices().subscribe((items) => {
      const item = items.find((i) => i.promoApplicationId === o.pendingApplicationId);
      if (!item) {
        this.reload();
        return;
      }
      this.dialog
        .open<PromoChoiceDialog, typeof item, PromoChoiceDialogResult>(PromoChoiceDialog, {
          data: item,
          width: '560px',
        })
        .afterClosed()
        .subscribe((result) => {
          if (result) this.reload();
        });
    });
  }

  protected exportOrders(format: ExportFormat) {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.fetchAllOrders()
      .then((rows) => {
        const table = this.buildExportTable(rows);
        return this.exporter.export(table, format);
      })
      .finally(() => this.exporting.set(false));
  }

  /** Doc 47, sección 10.3: exportar pide de a 100, todas las páginas. */
  private fetchAllOrders(): Promise<PromoReachOrderRow[]> {
    const fetchPage = (page: number, acc: PromoReachOrderRow[]): Promise<PromoReachOrderRow[]> =>
      new Promise((resolve, reject) => {
        this.promoSvc
          .reachOrders(this.promoId(), {
            from: this.from() || undefined,
            to: this.to() || undefined,
            salespersonId: this.salespersonFilter() ? Number(this.salespersonFilter()) : undefined,
            choiceStatus: (this.choiceStatusFilter() || undefined) as ReachChoiceStatus | undefined,
            page,
            size: 100,
          })
          .subscribe({
            next: (res) => {
              const merged = [...acc, ...(res.content ?? [])];
              if (page + 1 < (res.totalPages ?? 0)) {
                fetchPage(page + 1, merged).then(resolve, reject);
              } else {
                resolve(merged);
              }
            },
            error: reject,
          });
      });
    return fetchPage(0, []);
  }

  private buildExportTable(rows: PromoReachOrderRow[]): ExportTable<PromoReachOrderRow> {
    const r = this.reach();
    const columns: ExportColumn<PromoReachOrderRow>[] = [
      { key: 'orderDate', header: 'Fecha', type: 'datetime', value: (row) => row.orderDate },
      { key: 'orderId', header: 'Pedido', type: 'integer', value: (row) => row.orderId },
      {
        key: 'customerCode',
        header: 'Código cliente',
        type: 'code',
        value: (row) => row.customerCode,
      },
      { key: 'customerName', header: 'Cliente', type: 'text', value: (row) => row.customerName },
      {
        key: 'salespersonCode',
        header: 'Código vendedor',
        type: 'code',
        value: (row) => row.salespersonCode,
      },
      {
        key: 'salespersonName',
        header: 'Vendedor',
        type: 'text',
        value: (row) => row.salespersonName,
      },
      { key: 'tier', header: 'Tramo', type: 'integer', value: (row) => row.tier },
      {
        key: 'discountAmount',
        header: 'Descuento',
        type: 'money',
        value: (row) => row.discountAmount,
      },
      { key: 'bonusUnits', header: 'Unidades', type: 'quantity', value: (row) => row.bonusUnits },
      {
        key: 'orderStatusCode',
        header: 'Estado',
        type: 'text',
        value: (row) => orderStatusName(row.orderStatusCode),
      },
      {
        key: 'choiceStatus',
        header: 'Premio',
        type: 'text',
        value: (row) => choiceStatusLabel(row.choiceStatus),
      },
    ];
    return {
      title: 'Alcance de la promoción',
      subtitle: r ? `${r.code} · ${r.name}` : undefined,
      filters: [
        { label: 'Desde', value: dateText(this.from()) },
        { label: 'Hasta', value: dateText(this.to()) },
      ],
      columns,
      rows,
      fileName: exportFileName(['alcance', r?.code, this.from(), this.to()]),
    };
  }
}
