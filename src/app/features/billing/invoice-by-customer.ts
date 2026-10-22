import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { LookupService, toUiLookup } from '../promos/lookup';
import { InvoiceModuleTabs } from './ui/module-tabs';
import { InvoiceAdminService } from './invoice-admin';
import { InvoiceSummary } from '../../shared/models/invoice.models';
import { MATCH_STATUS_OPTIONS, matchStatusName } from './invoice-format';
import { dateText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...MATCH_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

/**
 * Facturas de un cliente (GET /invoices/by-customer/{id}). El filtro de
 * estado es frontend, sobre la página cargada: el endpoint solo documenta
 * page/size.
 */
@Component({
  selector: 'app-invoice-by-customer',
  imports: [RouterLink, UiButton, UiField, UiTypeahead, UiStatus, UiEmpty, InvoiceModuleTabs],
  template: `
    <app-invoice-module-tabs />
    <section class="ibc-page">
      <div class="ibc-head">
        <h1>Facturas por cliente</h1>
        <p class="ibc-sub">Busca un cliente para ver su historial de facturas.</p>
      </div>

      <div class="ibc-filters">
        <ui-typeahead
          label="Cliente — busca por nombre"
          [clearOnPick]="false"
          [search]="customerSearch"
          [(selected)]="customer"
        />
        <ui-field label="Estado" type="select" [(value)]="statusFilter" [options]="statusOptions" />
      </div>

      @if (!customer()) {
        <ui-empty title="Elige un cliente" body="Busca por nombre arriba para ver sus facturas." />
      } @else if (loading()) {
        <div class="ibc-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las facturas"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (filteredRows().length === 0) {
        <ui-empty title="Sin facturas" body="Este cliente no tiene facturas con ese filtro." />
      } @else {
        <table class="ui-table-grid ibc-table-desktop">
          <thead>
            <tr>
              <th>Comprobante</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Conciliación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (i of filteredRows(); track i.invoiceId) {
              <tr>
                <td class="ibc-cell-strong">
                  {{ i.documentTypeAbbr }} {{ i.series }}-{{ i.number }}
                </td>
                <td class="ibc-muted">{{ dateText(i.issueDate) }}</td>
                <td class="ibc-muted">{{ formatSoles(i.grandTotal) }}</td>
                <td><ui-status [label]="matchStatusName(i.matchStatusCode)" /></td>
                <td class="ibc-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/factura', i.invoiceId]"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="ibc-cards-mobile">
          @for (i of filteredRows(); track i.invoiceId) {
            <a [routerLink]="['/factura', i.invoiceId]" class="ibc-card-mobile">
              <div class="ibc-card-mobile-head">
                <span class="ibc-card-mobile-name"
                  >{{ i.documentTypeAbbr }} {{ i.series }}-{{ i.number }}</span
                >
                <ui-status [label]="matchStatusName(i.matchStatusCode)" />
              </div>
              <div class="ibc-muted">
                {{ dateText(i.issueDate) }} · {{ formatSoles(i.grandTotal) }}
              </div>
            </a>
          }
        </div>
      }

      @if (customer() && !loading() && !error() && rows().length > 0) {
        <div class="ibc-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="ibc-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .ibc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .ibc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ibc-filters {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) 220px;
        gap: 12px;
        margin: 24px 0;
        align-items: end;
      }
      .ibc-skeleton {
        height: 160px;
        background: var(--faint);
      }
      .ibc-cell-strong {
        font-weight: 800;
      }
      .ibc-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ibc-row-action {
        text-align: right;
      }
      .ibc-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .ibc-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .ibc-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ibc-page {
          padding: var(--sp-4);
        }
        .ibc-filters {
          grid-template-columns: 1fr;
        }
        .ibc-table-desktop {
          display: none;
        }
        .ibc-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ibc-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .ibc-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ibc-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class InvoiceByCustomerPage {
  private invoiceSvc = inject(InvoiceAdminService);
  private lookupSvc = inject(LookupService);

  protected dateText = dateText;
  protected formatSoles = formatSoles;
  protected matchStatusName = matchStatusName;
  protected statusOptions = STATUS_FILTER_OPTIONS;

  protected customer = signal<UiLookupItem | null>(null);
  protected statusFilter = signal('');
  protected rows = signal<InvoiceSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(false);
  protected error = signal(false);

  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));

  protected filteredRows = computed(() => {
    const filter = this.statusFilter();
    return filter ? this.rows().filter((i) => i.matchStatusCode === filter) : this.rows();
  });

  private customerEffect = effect(() => {
    this.customer();
    untracked(() => {
      this.page.set(0);
      if (this.customer()) this.load();
    });
  });

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
    const customerId = this.customer()?.id;
    if (!customerId) return;
    this.loading.set(true);
    this.error.set(false);
    this.invoiceSvc.byCustomer(customerId, { page: this.page(), size: this.size() }).subscribe({
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
