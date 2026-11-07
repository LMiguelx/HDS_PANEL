import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { CustomerService } from './customer';
import { AdminCustomerSummary } from '../../shared/models/customer.models';
import { ratingText } from './customer-format';

/** Buscador admin (GET /api/admin/customers) — todos los clientes del tenant. */
@Component({
  selector: 'app-customer-search',
  imports: [RouterLink, UiButton, UiField, UiToggle, UiTable, UiStatus, UiEmpty],
  template: `
    <section class="cs-page">
      <div class="cs-head">
        <div>
          <h1>Clientes</h1>
          <p class="cs-sub">{{ countText() }}</p>
        </div>
      </div>

      <div class="cs-filters">
        <ui-field
          label="Buscar"
          placeholder="Nombre, código o documento"
          [(value)]="query"
          class="cs-query"
        />
        <ui-toggle label="Solo activos" [(checked)]="onlyActive" />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los clientes."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Tu búsqueda no encontró nada"
              body="Prueba con otro nombre, código o documento."
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else {
            <ui-empty title="Sin clientes" body="Todavía no hay clientes registrados." />
          }
        </div>

        <table class="ui-table-grid cs-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Documento</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Hoy</th>
              <th>Calificación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.customerId) {
              <tr>
                <td>
                  <a [routerLink]="['/clientes', c.customerId]" class="cs-name-link">{{
                    c.businessName
                  }}</a>
                  <div class="cs-code">{{ c.code }}</div>
                </td>
                <td class="cs-muted">{{ c.documentNumber }}</td>
                <td class="cs-muted">{{ c.address || '—' }}</td>
                <td class="cs-muted">{{ c.phone || '—' }}</td>
                <td>
                  @if (c.visitStatusName) {
                    <ui-status [label]="c.visitStatusName" />
                  } @else {
                    <span class="cs-muted">Sin visita hoy</span>
                  }
                </td>
                <td class="cs-muted">{{ ratingText(c.rating) }}</td>
                <td class="cs-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/clientes', c.customerId]"
                  >
                    Ver ficha
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="cs-cards-mobile">
          @for (c of rows(); track c.customerId) {
            <a [routerLink]="['/clientes', c.customerId]" class="cs-card-mobile">
              <div class="cs-card-mobile-name">{{ c.businessName }}</div>
              <div class="cs-muted">{{ c.code }} · {{ c.documentNumber }}</div>
              <div class="cs-muted">{{ c.address || 'Sin dirección' }}</div>
              <div class="cs-muted">{{ ratingText(c.rating) }}</div>
            </a>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="cs-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="cs-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .cs-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .cs-head {
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
      .cs-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .cs-filters {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) auto;
        gap: 16px;
        align-items: end;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .cs-query {
        max-width: 420px;
      }
      .cs-name-link {
        font-weight: 800;
        text-decoration: none;
        color: var(--ink);
      }
      .cs-name-link:hover {
        color: var(--accent);
      }
      .cs-code {
        font-size: 12px;
        color: var(--ink-muted);
        margin-top: 2px;
      }
      .cs-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .cs-row-action {
        text-align: right;
      }
      .cs-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .cs-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .cs-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .cs-page {
          padding: var(--sp-4);
        }
        .cs-filters {
          grid-template-columns: 1fr;
        }
        .cs-table-desktop {
          display: none;
        }
        .cs-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .cs-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .cs-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class CustomerSearchPage implements OnInit, OnDestroy {
  private customerSvc = inject(CustomerService);

  protected ratingText = ratingText;

  protected query = signal('');
  protected onlyActive = signal(true);

  protected rows = signal<AdminCustomerSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  private reload$ = new Subject<void>();
  private filtersEffect = effect(() => {
    this.query();
    this.onlyActive();
    this.reload$.next();
  });

  ngOnInit() {
    this.reload$.pipe(debounceTime(250)).subscribe(() => {
      this.page.set(0);
      this.load();
    });
  }

  ngOnDestroy() {
    this.reload$.complete();
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 cliente' : `${n} clientes`;
  }

  protected hasActiveFilters(): boolean {
    return !!this.query() || !this.onlyActive();
  }

  protected clearFilters() {
    this.query.set('');
    this.onlyActive.set(true);
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
    this.customerSvc
      .adminSearch({
        q: this.query() || undefined,
        onlyActive: this.onlyActive() || undefined,
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
