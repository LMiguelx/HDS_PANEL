import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { LookupService, toUiLookup } from '../promos/lookup';
import { OrderModuleTabs } from './ui/module-tabs';
import { OrderAdminService } from './order-admin';
import { OrderSummary } from '../../shared/models/order.models';
import {
  DELIVERY_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  deliveryStatusName,
  orderStatusName,
} from './order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...ORDER_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

const DELIVERY_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todo el reparto' },
  ...DELIVERY_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

/**
 * Búsqueda global de pedidos (GET /orders, CU-22). Los filtros de estado son
 * frontend, sobre la página cargada: el endpoint solo documenta customerId/
 * salespersonId/page/size.
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
        <ui-field
          label="Reparto"
          type="select"
          [(value)]="deliveryFilter"
          [options]="deliveryOptions"
        />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los pedidos."
        [empty]="!loading() && !error() && filteredRows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasFrontendFilters()) {
            <ui-empty
              title="Sin pedidos con ese filtro en esta página"
              body="El filtro de estado se aplica sobre la página actual — prueba con otra página o quita el filtro."
              actionLabel="Limpiar filtros"
              (action)="clearFrontendFilters()"
            />
          } @else {
            <ui-empty title="Sin pedidos" body="No encontramos pedidos con esos criterios." />
          }
        </div>

        <table class="ui-table-grid ord-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Reparto</th>
              <th>Neto</th>
              <th>Bonificadas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (o of filteredRows(); track o.orderId) {
              <tr>
                <td class="ord-cell-strong">{{ o.customerName }}</td>
                <td class="ord-muted">{{ dateTimeText(o.orderDate) }}</td>
                <td><ui-status [label]="statusName(o.statusCode)" /></td>
                <td>
                  @if (o.deliveryStatusCode) {
                    <ui-status [label]="deliveryName(o.deliveryStatusCode)" />
                  } @else {
                    <span class="ord-muted">—</span>
                  }
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
          @for (o of filteredRows(); track o.orderId) {
            <a [routerLink]="['/pedidos/detalle', o.orderId]" class="ord-card-mobile">
              <div class="ord-card-mobile-head">
                <span class="ord-card-mobile-name">{{ o.customerName }}</span>
                <ui-status [label]="statusName(o.statusCode)" />
              </div>
              <div class="ord-muted">{{ dateTimeText(o.orderDate) }}</div>
              <div class="ord-muted">
                {{ formatSoles(o.netAmount) }}
                @if (o.deliveryStatusCode) {
                  · {{ deliveryName(o.deliveryStatusCode) }}
                }
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
        grid-template-columns: minmax(200px, 1fr) minmax(200px, 1fr) 200px 180px;
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
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

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected statusName = orderStatusName;
  protected deliveryName = deliveryStatusName;
  protected statusOptions = STATUS_FILTER_OPTIONS;
  protected deliveryOptions = DELIVERY_FILTER_OPTIONS;

  protected customerFilter = signal<UiLookupItem | null>(null);
  protected salespersonFilter = signal<UiLookupItem | null>(null);
  protected statusFilter = signal('');
  protected deliveryFilter = signal('');

  protected rows = signal<OrderSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  protected filteredRows = computed(() => {
    let rows = this.rows();
    const status = this.statusFilter();
    const delivery = this.deliveryFilter();
    if (status) rows = rows.filter((o) => o.statusCode === status);
    if (delivery) rows = rows.filter((o) => o.deliveryStatusCode === delivery);
    return rows;
  });

  protected hasFrontendFilters(): boolean {
    return !!(this.statusFilter() || this.deliveryFilter());
  }

  protected clearFrontendFilters() {
    this.statusFilter.set('');
    this.deliveryFilter.set('');
  }

  private serverFiltersEffect = effect(() => {
    this.customerFilter();
    this.salespersonFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 pedido' : `${n} pedidos`;
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
    this.orderSvc
      .list({
        customerId: this.customerFilter()?.id,
        salespersonId: this.salespersonFilter()?.id,
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
