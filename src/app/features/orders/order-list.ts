import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
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
import { dateText, dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...ORDER_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

const ORIGIN_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los orígenes' },
  ...ORDER_ORIGIN_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

interface FilterOverride {
  customerId?: number | null;
  customerName?: string | null;
  salespersonId?: number | null;
  salespersonName?: string | null;
  statusCode?: string;
  originCode?: string;
  from?: string;
  to?: string;
  month?: string;
  page?: number;
  size?: number;
}

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
          [selected]="customerFilter()"
          (selectedChange)="onCustomerChange($event)"
        />
        <ui-typeahead
          label="Vendedor"
          [clearOnPick]="false"
          [search]="userSearch"
          [selected]="salespersonFilter()"
          (selectedChange)="onSalespersonChange($event)"
        />
        <ui-field
          label="Estado"
          type="select"
          [value]="statusFilter()"
          (valueChange)="onStatusChange($event)"
          [options]="statusOptions"
        />
        <ui-field
          label="Origen"
          type="select"
          [value]="originFilter()"
          (valueChange)="onOriginChange($event)"
          [options]="originOptions"
        />
        <ui-field
          label="Día"
          type="date"
          [value]="dayFilter()"
          (valueChange)="setDayFilter($event)"
        />
        <div class="ord-month-field">
          <label for="ord-month">Mes</label>
          <input
            id="ord-month"
            type="month"
            class="ord-month-input"
            [value]="monthFilter()"
            (input)="setMonthFilter($any($event.target).value)"
          />
        </div>
      </div>

      @if (hasActiveFilters()) {
        <button type="button" class="ord-clear-link" (click)="clearFilters()">
          Limpiar filtros
        </button>
      }

      @if (seededRangeTo()) {
        <p class="ord-range-note">
          Mostrando del {{ dateText(dayFilter()) }} al {{ dateText(seededRangeTo()) }}. Cambia Día o
          Mes para volver a un solo período.
        </p>
      }

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
      .ord-range-note {
        margin: 0 0 var(--sp-4);
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .ord-clear-link {
        display: inline-block;
        margin: 10px 0 0;
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .ord-clear-link:hover {
        text-decoration: underline;
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
  private router = inject(Router);

  /**
   * La URL es la fuente de verdad (doc 70, sección 2): estos mismos nombres
   * ya los usaban Reportes de ventas/Aprobaciones para "sembrar" filtros al
   * entrar; ahora también se escriben de vuelta en cada cambio, así Ver
   * detalle → Atrás conserva filtros, página y orden.
   */
  salespersonIdParam = input('', { alias: 'salespersonId' });
  salespersonNameParam = input('', { alias: 'salespersonName' });
  customerIdParam = input('', { alias: 'customerId' });
  customerNameParam = input('', { alias: 'customerName' });
  fromParam = input('', { alias: 'from' });
  /** Rango real (no un solo día): doc 43, sección 5.6 — "por vendedor" llega con from≠to. */
  toParam = input('', { alias: 'to' });
  /** yyyy-MM — solo presente cuando el filtro activo es "Mes" (doc 70, sección 2.2). */
  monthParam = input('', { alias: 'mes' });
  statusCodeParam = input('', { alias: 'statusCode' });
  originCodeParam = input('', { alias: 'originCode' });
  pageParam = input('', { alias: 'page' });
  sizeParam = input('', { alias: 'size' });

  protected dateTimeText = dateTimeText;
  protected dateText = dateText;
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
  /** Rango exacto sembrado por otra pantalla (p. ej. Liquidación por vendedor); vacío = sin sembrar. */
  protected seededRangeTo = signal('');

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

  protected hasActiveFilters = computed(
    () =>
      !!this.customerIdParam() ||
      !!this.salespersonIdParam() ||
      !!this.statusCodeParam() ||
      !!this.originCodeParam(),
  );

  /**
   * La URL es la única fuente de verdad: cada navegación (propia o del
   * botón Atrás) actualiza el estado local y vuelve a pedir la página —
   * doc 70, sección 2.3, punto 1.
   */
  private urlFiltersEffect = effect(() => {
    const salespersonId = this.salespersonIdParam() ?? '';
    const salespersonName = this.salespersonNameParam() ?? '';
    const customerId = this.customerIdParam() ?? '';
    const customerName = this.customerNameParam() ?? '';
    const from = this.fromParam() ?? '';
    const to = this.toParam() ?? '';
    const month = this.monthParam() ?? '';
    const statusCode = this.statusCodeParam() ?? '';
    const originCode = this.originCodeParam() ?? '';
    const page = this.pageParam() ?? '';
    const size = this.sizeParam() ?? '';
    untracked(() => {
      this.salespersonFilter.set(
        salespersonId && salespersonName
          ? { id: Number(salespersonId), name: salespersonName }
          : null,
      );
      this.customerFilter.set(
        customerId && customerName ? { id: Number(customerId), name: customerName } : null,
      );
      this.statusFilter.set(statusCode);
      this.originFilter.set(originCode);
      this.page.set(page ? Number(page) : 0);
      this.size.set(size && Number(size) > 0 ? Number(size) : 20);

      if (month) {
        this.monthFilter.set(month);
        this.dayFilter.set(todayIso());
        this.seededRangeTo.set('');
      } else if (from) {
        this.monthFilter.set('');
        this.dayFilter.set(from);
        this.seededRangeTo.set(to && to !== from ? to : '');
      } else {
        // Primera visita sin fecha en la URL: hoy por defecto, escrito en la
        // URL (replaceUrl) para que quede explícito — doc 70, sección 2.3, punto 7.
        this.monthFilter.set('');
        this.dayFilter.set(todayIso());
        this.seededRangeTo.set('');
        this.navigateWithFilters({ from: todayIso(), to: todayIso() });
        return;
      }
      this.load();
    });
  });

  /** Tocar el día a mano abandona el mes/rango sembrado: vuelve a ser un filtro de un solo día. */
  protected setDayFilter(value: string) {
    this.navigateWithFilters({ from: value, to: value, month: '', page: 0 });
  }

  protected setMonthFilter(value: string) {
    this.navigateWithFilters({
      from: `${value}-01`,
      to: lastDayOfMonth(value),
      month: value,
      page: 0,
    });
  }

  protected onCustomerChange(item: UiLookupItem | null) {
    this.navigateWithFilters({
      customerId: item?.id ?? null,
      customerName: item?.name ?? null,
      page: 0,
    });
  }

  protected onSalespersonChange(item: UiLookupItem | null) {
    this.navigateWithFilters({
      salespersonId: item?.id ?? null,
      salespersonName: item?.name ?? null,
      page: 0,
    });
  }

  protected onStatusChange(value: string) {
    this.navigateWithFilters({ statusCode: value, page: 0 });
  }

  protected onOriginChange(value: string) {
    this.navigateWithFilters({ originCode: value, page: 0 });
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 pedido en el período' : `${n} pedidos en el período`;
  }

  protected clearFilters() {
    this.navigateWithFilters({
      customerId: null,
      customerName: null,
      salespersonId: null,
      salespersonName: null,
      statusCode: '',
      originCode: '',
      from: todayIso(),
      to: todayIso(),
      month: '',
      page: 0,
    });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.navigateWithFilters({ page: this.page() - 1 });
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.navigateWithFilters({ page: this.page() + 1 });
  }

  private dateRange(): { from: string; to: string } {
    const seededTo = this.seededRangeTo();
    if (seededTo) return { from: this.dayFilter(), to: seededTo };
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

  private currentDateParams(): { from: string; to: string; month: string } {
    const seededTo = this.seededRangeTo();
    if (seededTo) return { from: this.dayFilter(), to: seededTo, month: '' };
    const month = this.monthFilter();
    if (month) return { from: `${month}-01`, to: lastDayOfMonth(month), month };
    const day = this.dayFilter();
    return { from: day, to: day, month: '' };
  }

  /**
   * Única puerta de escritura a la URL — doc 70, sección 2.3, punto 2.
   * `replaceUrl: true` porque cada letra/clic de filtro no debe llenar el
   * historial: Atrás desde el detalle vuelve con el último filtro, no
   * recorre cada cambio intermedio.
   */
  private navigateWithFilters(override: FilterOverride) {
    const current = this.currentDateParams();
    const next = {
      customerId:
        override.customerId !== undefined
          ? override.customerId
          : (this.customerFilter()?.id ?? null),
      customerName:
        override.customerName !== undefined
          ? override.customerName
          : (this.customerFilter()?.name ?? null),
      salespersonId:
        override.salespersonId !== undefined
          ? override.salespersonId
          : (this.salespersonFilter()?.id ?? null),
      salespersonName:
        override.salespersonName !== undefined
          ? override.salespersonName
          : (this.salespersonFilter()?.name ?? null),
      statusCode: override.statusCode ?? this.statusFilter(),
      originCode: override.originCode ?? this.originFilter(),
      from: override.from ?? current.from,
      to: override.to ?? current.to,
      month: override.month ?? current.month,
      page: override.page ?? this.page(),
      size: override.size ?? this.size(),
    };
    this.router.navigate([], {
      queryParams: {
        customerId: next.customerId || null,
        customerName: next.customerName || null,
        salespersonId: next.salespersonId || null,
        salespersonName: next.salespersonName || null,
        statusCode: next.statusCode || null,
        originCode: next.originCode || null,
        from: next.from || null,
        to: next.to && next.to !== next.from ? next.to : null,
        mes: next.month || null,
        page: next.page || null,
        size: next.size !== 20 ? next.size : null,
      },
      replaceUrl: true,
    });
  }
}
