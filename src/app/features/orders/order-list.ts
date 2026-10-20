import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { LookupService, toUiLookup } from '../promos/lookup';
import { OrderModuleTabs } from './ui/module-tabs';
import { OrderAdminService } from './order-admin';
import { AdminOrderSummary } from '../../shared/models/order.models';
import {
  ORDER_ORIGIN_OPTIONS,
  ORDER_STATUS_OPTIONS,
  deliveryColumnText,
  orderStatusName,
  originName,
} from './order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...ORDER_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

const ORIGIN_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los orígenes' },
  ...ORDER_ORIGIN_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** yyyy-MM → yyyy-MM-dd del último día real de ese mes. */
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

/**
 * Listado operativo para encontrar un pedido y abrir su detalle — GET
 * /orders. Todo filtro (fecha, cliente, vendedor, estado) se resuelve en
 * el servidor antes de paginar; sin filtros de fecha el backend devuelve
 * solo los pedidos de hoy, por eso "Día" arranca precargado con hoy. No
 * existe filtro por reparto (columna informativa, sección 3.2 del doc).
 */
@Component({
  selector: 'app-order-list',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiTypeahead,
    UiTable,
    UiStatus,
    UiEmpty,
    HasPermissionDirective,
    OrderModuleTabs,
  ],
  template: `
    <app-order-module-tabs />
    <section class="ord-page">
      <div class="ord-head">
        <div>
          <h1>Pedidos</h1>
          <p class="ord-sub">{{ countText() }}</p>
        </div>
        <button
          uiButton
          variant="primary"
          *hasPermission="'order.manage'"
          routerLink="/pedidos/nuevo"
        >
          Nuevo pedido
        </button>
      </div>

      <div class="ord-filters">
        <ui-typeahead
          label="Cliente"
          [clearOnPick]="false"
          [search]="customerSearch"
          [(selected)]="customerFilter"
        />
        <ui-typeahead
          label="Vendedor"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="salespersonFilter"
        />
        <ui-field label="Estado" type="select" [(value)]="statusFilter" [options]="statusOptions" />
        <ui-field label="Origen" type="select" [(value)]="originFilter" [options]="originOptions" />
        <ui-field label="Día" type="date" [(value)]="dayFilter" />
        <div class="ord-month-field">
          <label for="ord-month">Mes</label>
          <input
            id="ord-month"
            type="month"
            class="ord-month-input"
            [value]="monthFilter()"
            (input)="monthFilter.set($any($event.target).value)"
          />
        </div>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los pedidos."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            title="Sin pedidos para los filtros elegidos"
            body="Prueba con otro rango de fechas o quita algún filtro."
            actionLabel="Limpiar filtros"
            (action)="clearFilters()"
          />
        </div>

        <table class="ui-table-grid ord-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Origen</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Reparto</th>
              <th>Neto</th>
              <th>Bonificadas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (o of rows(); track o.orderId) {
              <tr>
                <td class="ord-cell-strong">{{ o.customerName }}</td>
                <td class="ord-muted">
                  {{ o.salespersonName }}
                  @if (o.createdByName !== o.salespersonName) {
                    <div class="ord-registered-by">Registró: {{ o.createdByName }}</div>
                  }
                </td>
                <td>
                  @if (o.originCode === 'COUNTER' || o.originCode === 'TELESALES') {
                    <span
                      class="ord-origin-tag"
                      [class.ord-origin-telesales]="o.originCode === 'TELESALES'"
                      >{{ originName(o.originCode) }}</span
                    >
                  }
                </td>
                <td class="ord-muted">{{ dateTimeText(o.orderDate) }}</td>
                <td><ui-status [label]="statusName(o.statusCode)" /></td>
                <td class="ord-muted">
                  {{ deliveryColumnText(o.statusCode, o.deliveryStatusCode) }}
                </td>
                <td class="ord-muted">
                  {{ formatSoles(o.netAmount) }}
                  @if (o.discountAmount > 0) {
                    <span class="ord-discount">−{{ formatSoles(o.discountAmount) }}</span>
                  }
                </td>
                <td class="ord-muted">{{ o.bonusLines || '—' }}</td>
                <td class="ord-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/pedidos/detalle', o.orderId]"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="ord-cards-mobile">
          @for (o of rows(); track o.orderId) {
            <a [routerLink]="['/pedidos/detalle', o.orderId]" class="ord-card-mobile">
              <div class="ord-card-mobile-head">
                <span class="ord-card-mobile-name">{{ o.customerName }}</span>
                <ui-status [label]="statusName(o.statusCode)" />
              </div>
              <div class="ord-muted">
                {{ o.salespersonName }} · {{ dateTimeText(o.orderDate) }}
                @if (o.originCode === 'COUNTER' || o.originCode === 'TELESALES') {
                  ·
                  <span
                    class="ord-origin-tag"
                    [class.ord-origin-telesales]="o.originCode === 'TELESALES'"
                    >{{ originName(o.originCode) }}</span
                  >
                }
              </div>
              <div class="ord-muted">
                {{ formatSoles(o.netAmount) }} ·
                {{ deliveryColumnText(o.statusCode, o.deliveryStatusCode) }}
              </div>
            </a>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="ord-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="ord-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
    </section>
  `,
  styles: [
    `
      .ord-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ord-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .ord-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ord-filters {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .ord-month-field {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      .ord-month-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ord-month-input {
        font-family: var(--font-sans);
        font-size: 15px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        border-radius: 0;
        min-height: var(--touch-min);
        padding: 0 12px;
        width: 100%;
        box-sizing: border-box;
      }
      .ord-month-input:hover {
        border-color: var(--ink-muted);
      }
      .ord-month-input:focus-visible {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 1px var(--accent);
      }
      .ord-cell-strong {
        font-weight: 800;
      }
      .ord-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ord-discount {
        display: block;
        font-size: 11px;
        color: var(--accent-ink);
      }
      .ord-registered-by {
        font-size: 11px;
        margin-top: 2px;
      }
      .ord-origin-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--st-counter-delivered);
        border: 1px solid var(--st-counter-delivered);
        padding: 1px 6px;
        white-space: nowrap;
      }
      .ord-origin-telesales {
        color: var(--st-telesales);
        border-color: var(--st-telesales);
      }
      .ord-row-action {
        text-align: right;
      }
      .ord-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .ord-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .ord-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ord-page {
          padding: var(--sp-4);
        }
        .ord-filters {
          grid-template-columns: 1fr;
        }
        .ord-table-desktop {
          display: none;
        }
        .ord-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ord-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .ord-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ord-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class OrderListPage {
  private orderSvc = inject(OrderAdminService);
  private lookupSvc = inject(LookupService);

  /** Query params opcionales para llegar con filtros ya aplicados (desde Reportes de ventas, Aprobaciones). */
  salespersonIdParam = input('', { alias: 'salespersonId' });
  salespersonNameParam = input('', { alias: 'salespersonName' });
  customerIdParam = input('', { alias: 'customerId' });
  customerNameParam = input('', { alias: 'customerName' });
  fromParam = input('', { alias: 'from' });
  statusCodeParam = input('', { alias: 'statusCode' });
  originCodeParam = input('', { alias: 'originCode' });

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected statusName = orderStatusName;
  protected originName = originName;
  protected deliveryColumnText = deliveryColumnText;
  protected statusOptions = STATUS_FILTER_OPTIONS;
  protected originOptions = ORIGIN_FILTER_OPTIONS;

  protected customerFilter = signal<UiLookupItem | null>(null);
  protected salespersonFilter = signal<UiLookupItem | null>(null);
  protected statusFilter = signal('');
  protected originFilter = signal('');
  protected dayFilter = signal(todayIso());
  protected monthFilter = signal('');

  protected rows = signal<AdminOrderSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  private serverFiltersEffect = effect(() => {
    this.customerFilter();
    this.salespersonFilter();
    this.statusFilter();
    this.originFilter();
    this.dayFilter();
    this.monthFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  private seedQueryParamsEffect = effect(() => {
    const salespersonId = this.salespersonIdParam();
    const salespersonName = this.salespersonNameParam();
    const customerId = this.customerIdParam();
    const customerName = this.customerNameParam();
    const from = this.fromParam();
    const statusCode = this.statusCodeParam();
    const originCode = this.originCodeParam();
    untracked(() => {
      if (salespersonId && salespersonName) {
        this.salespersonFilter.set({ id: Number(salespersonId), name: salespersonName });
      }
      if (customerId && customerName) {
        this.customerFilter.set({ id: Number(customerId), name: customerName });
      }
      if (from) {
        this.monthFilter.set('');
        this.dayFilter.set(from);
      }
      if (statusCode) this.statusFilter.set(statusCode);
      if (originCode) this.originFilter.set(originCode);
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 pedido en el período' : `${n} pedidos en el período`;
  }

  protected clearFilters() {
    this.customerFilter.set(null);
    this.salespersonFilter.set(null);
    this.statusFilter.set('');
    this.originFilter.set('');
    this.monthFilter.set('');
    this.dayFilter.set(todayIso());
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

  private dateRange(): { from: string; to: string } {
    const month = this.monthFilter();
    if (month) return { from: `${month}-01`, to: lastDayOfMonth(month) };
    const day = this.dayFilter();
    return { from: day, to: day };
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc
      .list({
        ...this.dateRange(),
        customerId: this.customerFilter()?.id,
        salespersonId: this.salespersonFilter()?.id,
        statusCode: this.statusFilter() || undefined,
        originCode: this.originFilter() || undefined,
        page: this.page(),
        size: this.size(),
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
