import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { DeliveryAdminService } from './delivery-admin';
import { BatchSummary } from '../../shared/models/delivery.models';
import { BATCH_STATUS_OPTIONS, batchStatusName } from './delivery-format';
import { dateText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...BATCH_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

/**
 * Todas las planillas del tenant, sin filtro de fecha (GET /batches/all) —
 * browse histórico completo para supervisión. El filtro de estado es
 * frontend, sobre la página cargada: el endpoint solo documenta page/size.
 */
@Component({
  selector: 'app-delivery-batches',
  imports: [RouterLink, UiButton, UiField, UiTable, UiStatus, UiEmpty],
  template: `
    <section class="db-page">
      <div class="db-head">
        <div>
          <h1>Planillas de reparto</h1>
          <p class="db-sub">{{ countText() }}</p>
        </div>
      </div>

      <div class="db-filters">
        <ui-field label="Estado" type="select" [(value)]="statusFilter" [options]="statusOptions" />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las planillas."
        [empty]="!loading() && !error() && filteredRows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (statusFilter()) {
            <ui-empty
              title="Sin planillas con ese estado en esta página"
              body="El filtro se aplica sobre la página actual — prueba con otra página o quita el filtro."
              actionLabel="Limpiar filtro"
              (action)="statusFilter.set('')"
            />
          } @else {
            <ui-empty title="Sin planillas" body="Todavía no hay planillas registradas." />
          }
        </div>

        <table class="ui-table-grid db-table-desktop">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Serie-Número</th>
              <th>Equipo</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Ítems</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of filteredRows(); track b.batchId) {
              <tr>
                <td class="db-muted">{{ dateText(b.batchDate) }}</td>
                <td class="db-cell-strong">{{ b.series }}-{{ b.number }}</td>
                <td class="db-muted">{{ b.vehiclePlate || 'Sin asignar' }}</td>
                <td><ui-status [label]="statusName(b.statusCode)" /></td>
                <td class="db-muted">{{ formatSoles(b.totalAmount) }}</td>
                <td class="db-muted">{{ b.totalItems - b.pendingItems }}/{{ b.totalItems }}</td>
                <td class="db-row-action">
                  <button uiButton variant="ghost" size="sm" [routerLink]="['/reparto', b.batchId]">
                    Ver detalle
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="db-cards-mobile">
          @for (b of filteredRows(); track b.batchId) {
            <a [routerLink]="['/reparto', b.batchId]" class="db-card-mobile">
              <div class="db-card-mobile-head">
                <span class="db-card-mobile-name">{{ b.series }}-{{ b.number }}</span>
                <ui-status [label]="statusName(b.statusCode)" />
              </div>
              <div class="db-muted">
                {{ dateText(b.batchDate) }} · {{ b.vehiclePlate || 'Sin asignar' }}
              </div>
              <div class="db-muted">
                {{ formatSoles(b.totalAmount) }} · {{ b.totalItems - b.pendingItems }}/{{
                  b.totalItems
                }}
                ítems
              </div>
            </a>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="db-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="db-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .db-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .db-head {
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
      .db-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .db-filters {
        display: grid;
        grid-template-columns: 220px;
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .db-cell-strong {
        font-weight: 800;
      }
      .db-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .db-row-action {
        text-align: right;
      }
      .db-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .db-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .db-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .db-page {
          padding: var(--sp-4);
        }
        .db-filters {
          grid-template-columns: 1fr;
        }
        .db-table-desktop {
          display: none;
        }
        .db-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .db-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .db-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .db-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class DeliveryBatchesPage {
  private deliverySvc = inject(DeliveryAdminService);

  protected dateText = dateText;
  protected formatSoles = formatSoles;
  protected statusName = batchStatusName;
  protected statusOptions = STATUS_FILTER_OPTIONS;

  protected rows = signal<BatchSummary[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);
  protected statusFilter = signal('');

  protected filteredRows = computed(() => {
    const filter = this.statusFilter();
    return filter ? this.rows().filter((b) => b.statusCode === filter) : this.rows();
  });

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 planilla' : `${n} planillas`;
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
    this.deliverySvc.batchesAll({ page: this.page(), size: this.size() }).subscribe({
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
