import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { LookupService, toUiLookup } from '../promos/lookup';
import { OrderAdminService } from '../orders/order-admin';
import { BillingValidationModuleTabs } from './ui/billing-module-tabs';
import { AdminOrderSummary } from '../../shared/models/order.models';
import { dateTimeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Validación de pedidos — "Enviados" (doc 32, sección 9): pedidos ya
 * enviados a facturación y si facturación ya los recibió. Reutiliza el
 * listado de pedidos con el estado fijo en SENT_TO_BILLING. Solo lectura.
 */
@Component({
  selector: 'app-billing-sent-tab',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiTypeahead,
    UiStatus,
    UiEmpty,
    BillingValidationModuleTabs,
  ],
  template: `
    <app-billing-validation-module-tabs />
    <section class="bst-page">
      <div class="bst-head">
        <div>
          <h1>Enviados</h1>
          <p class="bst-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="secondary" [loading]="loading()" (click)="load()">
          Actualizar
        </button>
      </div>

      <div class="bst-filters">
        <ui-field label="Fecha del pedido" type="date" [(value)]="dayFilter" />
        <ui-typeahead
          label="Vendedor"
          placeholder="Todos"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="vendorFilter"
        />
      </div>

      @if (loading()) {
        <div class="bst-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los pedidos"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (rows().length === 0) {
        <ui-empty title="Sin pedidos enviados" body="No hay pedidos enviados en esta fecha." />
      } @else {
        <table class="ui-table-grid bst-table-desktop">
          <thead>
            <tr>
              <th>N.º</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Neto</th>
              <th>Enviado</th>
              <th>Facturación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (o of rows(); track o.orderId) {
              <tr>
                <td class="bst-cell-strong">{{ o.orderId }}</td>
                <td>{{ o.customerName }}</td>
                <td class="bst-muted">{{ o.salespersonName }}</td>
                <td class="bst-muted">{{ formatSoles(o.netAmount) }}</td>
                <td class="bst-muted">{{ dateTimeText(o.sentToBillingAt) }}</td>
                <td>
                  @if (o.erpUploaded) {
                    <ui-status label="Recibido" status="vigente" />
                    <span class="bst-muted">{{ dateTimeText(o.erpUploadedAt) }}</span>
                  } @else {
                    <ui-status label="Pendiente" status="pendiente" />
                  }
                </td>
                <td class="bst-row-action">
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

        <div class="bst-cards-mobile">
          @for (o of rows(); track o.orderId) {
            <a [routerLink]="['/pedidos/detalle', o.orderId]" class="bst-card-mobile">
              <div class="bst-card-mobile-head">
                <span class="bst-card-mobile-name">#{{ o.orderId }} {{ o.customerName }}</span>
                @if (o.erpUploaded) {
                  <ui-status label="Recibido" status="vigente" />
                } @else {
                  <ui-status label="Pendiente" status="pendiente" />
                }
              </div>
              <div class="bst-muted">{{ o.salespersonName }} · {{ formatSoles(o.netAmount) }}</div>
              <div class="bst-muted">Enviado {{ dateTimeText(o.sentToBillingAt) }}</div>
            </a>
          }
        </div>

        <div class="bst-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="bst-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .bst-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bst-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .bst-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .bst-filters {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
        gap: 12px;
        margin: 20px 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .bst-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .bst-table-desktop {
        width: 100%;
      }
      .bst-cell-strong {
        font-weight: 800;
      }
      .bst-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bst-row-action {
        text-align: right;
      }
      .bst-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .bst-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .bst-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .bst-page {
          padding: var(--sp-4);
        }
        .bst-table-desktop {
          display: none;
        }
        .bst-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .bst-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .bst-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .bst-card-mobile-name {
          font-weight: 800;
          font-size: 14px;
        }
      }
    `,
  ],
})
export class BillingSentTab {
  private orderSvc = inject(OrderAdminService);
  private lookupSvc = inject(LookupService);

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;

  protected dayFilter = signal(todayIso());
  protected vendorFilter = signal<UiLookupItem | null>(null);

  protected rows = signal<AdminOrderSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  private filtersEffect = effect(() => {
    this.dayFilter();
    this.vendorFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 pedido enviado' : `${n} pedidos enviados`;
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
        from: this.dayFilter(),
        to: this.dayFilter(),
        statusCode: 'SENT_TO_BILLING',
        salespersonId: this.vendorFilter()?.id,
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
