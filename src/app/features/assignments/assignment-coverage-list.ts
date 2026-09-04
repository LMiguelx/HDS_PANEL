import { Component, effect, inject, signal, untracked } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { LookupService, toUiLookup } from '../promos/lookup';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { AssignmentAdminService } from './assignment-admin';
import { CoverageAdminView } from '../../shared/models/assignment-admin.models';
import { dateText, dateTimeText } from './assignment-format';

/**
 * Coberturas ya realizadas (GET /coverage) — para que el supervisor
 * confirme que una cobertura puntual no siga apareciendo al día siguiente.
 */
@Component({
  selector: 'app-assignment-coverage-list',
  imports: [UiButton, UiTypeahead, UiTable, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="cvl-page">
      <div class="cvl-head">
        <h1>Coberturas realizadas</h1>
        <p class="cvl-sub">{{ countText() }}</p>
      </div>

      <div class="cvl-filters">
        <ui-typeahead
          label="Vendedor ausente"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="absentFilter"
        />
        <ui-typeahead
          label="Vendedor que cubrió"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="coveringFilter"
        />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las coberturas."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Tus filtros no encontraron nada"
              body="Prueba con otro vendedor o quita algún filtro."
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else {
            <ui-empty
              title="Todavía no hay coberturas"
              body="Las coberturas puntuales aparecerán acá."
            />
          }
        </div>

        <table class="ui-table-grid cvl-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Ausente</th>
              <th>Cubrió</th>
              <th>Fecha</th>
              <th>Motivo</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            @for (c of rows(); track c.coverageId) {
              <tr>
                <td class="cvl-cell-strong">{{ c.customerName }}</td>
                <td>{{ c.absentUserName }}</td>
                <td>{{ c.coveringUserName }}</td>
                <td class="cvl-muted">{{ dateText(c.coverageDate) }}</td>
                <td class="cvl-muted">{{ c.reason || '—' }}</td>
                <td class="cvl-muted">{{ dateTimeText(c.createdAt) }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="cvl-cards-mobile">
          @for (c of rows(); track c.coverageId) {
            <div class="cvl-card-mobile">
              <div class="cvl-card-mobile-name">{{ c.customerName }}</div>
              <div class="cvl-muted">{{ c.absentUserName }} → {{ c.coveringUserName }}</div>
              <div class="cvl-muted">{{ dateText(c.coverageDate) }}</div>
              @if (c.reason) {
                <div class="cvl-muted">{{ c.reason }}</div>
              }
            </div>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="cvl-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="cvl-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .cvl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .cvl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .cvl-filters {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr);
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .cvl-cell-strong {
        font-weight: 800;
      }
      .cvl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .cvl-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .cvl-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .cvl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .cvl-page {
          padding: var(--sp-4);
        }
        .cvl-filters {
          grid-template-columns: 1fr;
        }
        .cvl-table-desktop {
          display: none;
        }
        .cvl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .cvl-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .cvl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class AssignmentCoverageListPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private lookupSvc = inject(LookupService);

  protected dateText = dateText;
  protected dateTimeText = dateTimeText;

  protected absentFilter = signal<UiLookupItem | null>(null);
  protected coveringFilter = signal<UiLookupItem | null>(null);

  protected rows = signal<CoverageAdminView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  private filtersEffect = effect(() => {
    this.absentFilter();
    this.coveringFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 cobertura' : `${n} coberturas`;
  }

  protected hasActiveFilters(): boolean {
    return !!(this.absentFilter() || this.coveringFilter());
  }

  protected clearFilters() {
    this.absentFilter.set(null);
    this.coveringFilter.set(null);
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
    this.assignmentSvc
      .coverageList({
        absentUserId: this.absentFilter()?.id,
        coveringUserId: this.coveringFilter()?.id,
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
