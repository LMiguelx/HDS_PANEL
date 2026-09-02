import { Component, effect, inject, signal, untracked } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../promos/lookup';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CreateAssignmentDialog } from './ui/create-assignment-dialog';
import { ScheduleDialog } from './ui/schedule-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { AssignmentView } from '../../shared/models/assignment-admin.models';
import { dateText, resolveNames, weekdaysText, weeksOfCycleText } from './assignment-format';

const HAS_GAP_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los horarios' },
  { value: 'true', label: 'Horario incompleto' },
  { value: 'false', label: 'Horario completo' },
];

/** Listado paginado de asignaciones vigentes (GET /api/admin/assignments). */
@Component({
  selector: 'app-assignment-list',
  imports: [UiButton, UiField, UiTypeahead, UiTable, UiEmpty, UiMenu, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="asl-page">
      <div class="asl-head">
        <div>
          <h1>Asignaciones vigentes</h1>
          <p class="asl-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Asignación manual</button>
      </div>

      <div class="asl-filters">
        <ui-typeahead
          label="Vendedor"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="vendorFilter"
        />
        <ui-typeahead
          label="Cliente"
          [clearOnPick]="false"
          [search]="customerSearch"
          [(selected)]="customerFilter"
        />
        <ui-field label="Horario" type="select" [(value)]="hasGap" [options]="hasGapOptions" />
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar las asignaciones."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Tus filtros no encontraron nada"
              body="Prueba con otro vendedor, cliente o quita algún filtro."
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else {
            <ui-empty
              title="Todavía no hay asignaciones"
              body="Crea la primera asignación manual para empezar."
            />
          }
        </div>

        <table class="ui-table-grid asl-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Vigencia</th>
              <th>Días</th>
              <th>Semanas del ciclo</th>
              <th>Horario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (a of rows(); track a.assignmentId) {
              <tr>
                <td class="asl-cell-strong">{{ customerName(a.customerId) }}</td>
                <td>{{ vendorName(a.userId) }}</td>
                <td class="asl-muted">
                  {{ dateText(a.effectiveFrom) }} –
                  {{ a.effectiveTo ? dateText(a.effectiveTo) : 'vigente' }}
                </td>
                <td class="asl-muted">{{ weekdaysText(a.weekdays) }}</td>
                <td class="asl-muted">{{ weeksOfCycleText(a.weeksOfCycle) }}</td>
                <td>
                  @if (isIncomplete(a)) {
                    <span class="asl-badge">Incompleto</span>
                  } @else {
                    <span class="asl-muted">Completo</span>
                  }
                </td>
                <td class="asl-row-menu-cell">
                  <ui-menu label="Editar horario, finalizar">
                    <button type="button" (click)="editSchedule(a)">Editar horario</button>
                    <button type="button" (click)="end(a)">Finalizar</button>
                  </ui-menu>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="asl-cards-mobile">
          @for (a of rows(); track a.assignmentId) {
            <div class="asl-card-mobile">
              <div class="asl-card-mobile-head">
                <span class="asl-card-mobile-name">{{ customerName(a.customerId) }}</span>
                @if (isIncomplete(a)) {
                  <span class="asl-badge">Incompleto</span>
                }
              </div>
              <div class="asl-muted">Vendedor: {{ vendorName(a.userId) }}</div>
              <div class="asl-muted">
                {{ dateText(a.effectiveFrom) }} –
                {{ a.effectiveTo ? dateText(a.effectiveTo) : 'vigente' }}
              </div>
              <div class="asl-muted">
                {{ weekdaysText(a.weekdays) }} · Semanas {{ weeksOfCycleText(a.weeksOfCycle) }}
              </div>
              <div class="asl-card-mobile-actions">
                <button uiButton variant="secondary" size="sm" (click)="editSchedule(a)">
                  Editar horario
                </button>
                <button uiButton variant="ghost" size="sm" (click)="end(a)">Finalizar</button>
              </div>
            </div>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="asl-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="asl-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .asl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .asl-head {
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
      .asl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .asl-filters {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) 200px;
        gap: 12px;
        margin: 24px 0 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .asl-cell-strong {
        font-weight: 800;
      }
      .asl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .asl-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }
      .asl-row-menu-cell {
        text-align: right;
        width: 44px;
      }
      .asl-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .asl-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .asl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .asl-page {
          padding: var(--sp-4);
        }
        .asl-filters {
          grid-template-columns: 1fr;
        }
        .asl-table-desktop {
          display: none;
        }
        .asl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .asl-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .asl-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .asl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .asl-card-mobile-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }
      }
    `,
  ],
})
export class AssignmentListPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);

  protected dateText = dateText;
  protected weekdaysText = weekdaysText;
  protected weeksOfCycleText = weeksOfCycleText;
  protected hasGapOptions = HAS_GAP_OPTIONS;

  protected vendorFilter = signal<UiLookupItem | null>(null);
  protected customerFilter = signal<UiLookupItem | null>(null);
  protected hasGap = signal('');

  protected rows = signal<AssignmentView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(true);
  protected error = signal(false);

  // Decisión tomada para el "pendiente de UX" del documento (GET / solo trae
  // IDs): se resuelven nombres reutilizando GET /map con los vendedores de
  // la página actual — ver resolveNames() en assignment-format.ts.
  private customerNames = signal<Map<number, string>>(new Map());
  private vendorNames = signal<Map<number, string>>(new Map());

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));
  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));

  private filtersEffect = effect(() => {
    this.vendorFilter();
    this.customerFilter();
    this.hasGap();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 asignación' : `${n} asignaciones`;
  }

  protected hasActiveFilters(): boolean {
    return !!(this.vendorFilter() || this.customerFilter() || this.hasGap());
  }

  protected clearFilters() {
    this.vendorFilter.set(null);
    this.customerFilter.set(null);
    this.hasGap.set('');
  }

  protected isIncomplete(a: AssignmentView): boolean {
    return (a.weekdays?.length ?? 0) === 0 || (a.weeksOfCycle?.length ?? 0) === 0;
  }

  protected customerName(id: number): string {
    return this.customerNames().get(id) ?? `Cliente #${id}`;
  }
  protected vendorName(id: number): string {
    return this.vendorNames().get(id) ?? `Vendedor #${id}`;
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
      .list({
        userId: this.vendorFilter()?.id,
        customerId: this.customerFilter()?.id,
        hasGap: this.hasGap() ? this.hasGap() === 'true' : undefined,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.totalElements.set(result.totalElements ?? 0);
          this.totalPages.set(result.totalPages ?? 0);
          this.loading.set(false);
          this.enrichNames(result.content ?? []);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  private enrichNames(rows: AssignmentView[]) {
    const userIds = rows.map((r) => r.userId);
    if (userIds.length === 0) return;
    resolveNames(this.assignmentSvc, userIds).subscribe(({ customers, vendors }) => {
      this.customerNames.set(customers);
      this.vendorNames.set(vendors);
    });
  }

  protected openCreate() {
    this.dialog
      .open(CreateAssignmentDialog, { width: '520px' })
      .afterClosed()
      .subscribe((created) => created && this.load());
  }

  protected editSchedule(a: AssignmentView) {
    this.dialog
      .open(ScheduleDialog, {
        data: {
          assignmentId: a.assignmentId,
          customerName: this.customerName(a.customerId),
          weekdays: a.weekdays ?? [],
          weeksOfCycle: a.weeksOfCycle ?? [],
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }

  protected end(a: AssignmentView) {
    this.dialog
      .confirm({
        title: 'Finalizar asignación',
        message: `¿Finalizar la asignación de ${this.customerName(a.customerId)} con ${this.vendorName(a.userId)}? Queda vigente hasta hoy.`,
        confirmLabel: 'Finalizar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.assignmentSvc.end(a.assignmentId).subscribe(() => this.load());
      });
  }
}
