import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiMenu } from '../../shared/ui/menu/menu';
import { UiCheckbox } from '../../shared/ui/checkbox/checkbox';
import { UiStatus } from '../../shared/ui/status/status';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../promos/lookup';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CreateAssignmentDialog } from './ui/create-assignment-dialog';
import { ScheduleDialog } from './ui/schedule-dialog';
import { BulkAssignDialog, BulkAssignDialogData } from './ui/bulk-assign-dialog';
import { AssignmentAdminService } from './assignment-admin';
import {
  PortfolioCustomerRow,
  PortfolioScheduleFilter,
  PortfolioScheduleStatus,
  PortfolioStatusFilter,
  PortfolioSummary,
} from '../../shared/models/assignment-admin.models';
import { dateText } from './assignment-format';

const STATUS_OPTIONS: UiFieldOption[] = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
  { value: 'ALL', label: 'Todos' },
];
const SCHEDULE_OPTIONS: UiFieldOption[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'NO_SELLER', label: 'Sin vendedor' },
  { value: 'INCOMPLETE', label: 'Horario incompleto' },
  { value: 'COMPLETE', label: 'Completo' },
];
const SIZE_OPTIONS: UiFieldOption[] = [
  { value: '20', label: '20 por página' },
  { value: '50', label: '50 por página' },
  { value: '100', label: '100 por página' },
];

const SCHEDULE_STATUS_LABEL: Record<PortfolioScheduleStatus, string> = {
  COMPLETE: 'Completo',
  INCOMPLETE: 'Horario incompleto',
  NO_SELLER: 'Sin vendedor',
};
const SCHEDULE_STATUS_TONE: Record<PortfolioScheduleStatus, string> = {
  COMPLETE: '--status-ok',
  INCOMPLETE: '--status-warn',
  NO_SELLER: '--status-warn',
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

/** Resumen de una fila seleccionada, lo necesario para el modal de lote — vive mientras dura la selección, no depende de que la fila siga cargada en pantalla. */
interface SelectedCustomer {
  customerId: number;
  code: string;
  businessName: string;
  salespersonId: number | null;
  salespersonName: string | null;
}

interface FilterOverride {
  q?: string;
  status?: PortfolioStatusFilter;
  schedule?: PortfolioScheduleFilter;
  userId?: string;
  userName?: string;
  page?: number;
  size?: number;
}

const MAX_BULK = 200;

/**
 * Cartera — doc 68, secciones 3 a 6. Reemplaza Inicio + Listado + Huérfanos
 * + Horario incompleto del módulo de Asignaciones con una sola pantalla:
 * tarjetas de resumen, filtros en el servidor (estado en la URL) y
 * selección para asignar en lote. La URL es la fuente de verdad, mismo
 * patrón que Usuarios (doc 66).
 */
@Component({
  selector: 'app-portfolio',
  imports: [
    UiButton,
    UiField,
    UiTypeahead,
    UiTable,
    UiEmpty,
    UiMenu,
    UiCheckbox,
    UiStatus,
    AssignmentModuleTabs,
  ],
  template: `
    <app-assignment-module-tabs />
    <section class="pf-page">
      <div class="pf-head">
        <h1>Cartera</h1>
        <p class="pf-sub">
          Clientes con su vendedor y horario de visita. Elige clientes para asignarlos de una vez.
        </p>
      </div>

      <div class="pf-cards">
        <button
          type="button"
          class="pf-card"
          [class.selected]="cardSelected('ACTIVE', 'ALL')"
          (click)="selectCard('ACTIVE', 'ALL')"
        >
          <span class="pf-card-label">Activos</span>
          @if (summary(); as s) {
            <span class="pf-card-value">{{ s.active }}</span>
            <span class="pf-card-detail">{{ s.complete }} completos</span>
          } @else {
            <span class="pf-card-value pf-card-skel"></span>
          }
        </button>

        <button
          type="button"
          class="pf-card"
          [class.selected]="cardSelected('ACTIVE', 'NO_SELLER')"
          (click)="selectCard('ACTIVE', 'NO_SELLER')"
        >
          <span class="pf-card-label">Sin vendedor</span>
          @if (summary(); as s) {
            <span class="pf-card-value" [class.pf-card-warn]="s.noSeller > 0">{{
              s.noSeller || '—'
            }}</span>
            <span class="pf-card-detail">{{ s.noSeller > 0 ? 'Por asignar' : 'Al día' }}</span>
          } @else {
            <span class="pf-card-value pf-card-skel"></span>
          }
        </button>

        <button
          type="button"
          class="pf-card"
          [class.selected]="cardSelected('ACTIVE', 'INCOMPLETE')"
          (click)="selectCard('ACTIVE', 'INCOMPLETE')"
        >
          <span class="pf-card-label">Horario incompleto</span>
          @if (summary(); as s) {
            <span class="pf-card-value" [class.pf-card-warn]="s.incomplete > 0">{{
              s.incomplete || '—'
            }}</span>
            <span class="pf-card-detail">{{
              s.incomplete > 0 ? 'No salen en ninguna ruta' : 'Al día'
            }}</span>
          } @else {
            <span class="pf-card-value pf-card-skel"></span>
          }
        </button>

        <button
          type="button"
          class="pf-card"
          [class.selected]="cardSelected('INACTIVE', 'ALL')"
          (click)="selectCard('INACTIVE', 'ALL')"
        >
          <span class="pf-card-label">Inactivos</span>
          @if (summary(); as s) {
            <span class="pf-card-value pf-card-muted">{{ s.inactive || '—' }}</span>
            <span class="pf-card-detail">Asignación en pausa</span>
          } @else {
            <span class="pf-card-value pf-card-skel"></span>
          }
        </button>

        <button type="button" class="pf-card" (click)="goToAbsences()">
          <span class="pf-card-label">Sin asistencia hoy</span>
          @if (absentVendors(); as n) {
            <span class="pf-card-value" [class.pf-card-danger]="n > 0">{{ n }}</span>
          } @else {
            <span class="pf-card-value pf-card-skel"></span>
          }
          <span class="pf-card-detail pf-card-link">Ver ausencias →</span>
        </button>
      </div>

      <div class="pf-filters">
        <ui-field
          label="Buscar"
          icon="search"
          placeholder="Nombre, código o documento"
          [(value)]="searchDraft"
        />
        <ui-typeahead
          label="Vendedor"
          [clearOnPick]="false"
          [search]="userSearch"
          [selected]="vendorFilter()"
          (selectedChange)="onVendorChange($event)"
        />
        <ui-field
          label="Estado"
          type="select"
          [value]="statusFilter()"
          [options]="statusOptions"
          (valueChange)="onStatusChange($event)"
        />
        <ui-field
          label="Horario"
          type="select"
          [value]="scheduleFilter()"
          [options]="scheduleOptions"
          (valueChange)="onScheduleChange($event)"
        />
        @if (hasActiveFilters()) {
          <button type="button" class="pf-clear" (click)="clearFilters()">Limpiar</button>
        }
      </div>

      @if (selected().size > 0) {
        <div class="pf-selection-bar">
          @if (showPageHint()) {
            <span class="pf-selection-hint"
              >Seleccionaste {{ selected().size }} de esta página.</span
            >
          }
          <span class="pf-selection-text">{{ selected().size }} clientes seleccionados</span>
          <div class="pf-selection-actions">
            <button uiButton variant="primary" size="sm" (click)="openBulkAssign()">
              Asignar en lote
            </button>
            <button uiButton variant="ghost" size="sm" (click)="clearSelection()">
              Quitar selección
            </button>
          </div>
        </div>
      }

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No se pudo cargar la cartera."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Ningún cliente coincide con los filtros"
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else if (scheduleFilter() === 'NO_SELLER') {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              title="No hay clientes sin vendedor."
              body="Todos los clientes activos tienen cartera asignada."
            />
          } @else if (scheduleFilter() === 'INCOMPLETE') {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              title="No hay horarios incompletos."
              body="Todos los clientes asignados salen en su ruta."
            />
          } @else if (statusFilter() === 'INACTIVE') {
            <ui-empty title="No hay clientes inactivos." />
          } @else {
            <ui-empty title="Sin clientes" />
          }
        </div>

        <table class="ui-table-grid pf-table">
          <thead>
            <tr>
              <th class="pf-th-check">
                <ui-checkbox
                  label="Seleccionar la página"
                  [checked]="pageAllSelected()"
                  [indeterminate]="pageIndeterminate()"
                  (checkedChange)="toggleSelectPage()"
                />
              </th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Días</th>
              <th>Semanas</th>
              <th>Horario</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.customerId) {
              <tr class="pf-row" [class.pf-row-inactive]="!row.active" (click)="openCustomer(row)">
                <td class="pf-td-check" (click)="$event.stopPropagation()">
                  <span class="pf-row-num">{{ pageFrom() + $index }}</span>
                  <ui-checkbox
                    [label]="'Seleccionar ' + row.businessName"
                    [checked]="isSelected(row.customerId)"
                    [disabled]="!row.active || (!isSelected(row.customerId) && atMaxSelection())"
                    [attr.title]="checkboxTitle(row)"
                    (checkedChange)="toggleRow(row)"
                  />
                </td>
                <td class="pf-cell-strong" [title]="row.address || ''">
                  {{ row.businessName }}
                  <div class="pf-muted">
                    {{ row.code }}
                    @if (row.documentNumber) {
                      · {{ row.documentNumber }}
                    }
                  </div>
                </td>
                <td>
                  @if (row.salespersonName) {
                    {{ row.salespersonCode }} {{ row.salespersonName }}
                    @if (!row.active) {
                      <span class="pf-paused">en pausa</span>
                    }
                    <div class="pf-muted">desde {{ dateText(row.assignedSince) }}</div>
                  } @else {
                    <span class="pf-warn">— Sin vendedor</span>
                  }
                </td>
                <td class="pf-muted">
                  @if (row.weekdays.length === 0) {
                    @if (row.salespersonName) {
                      <span class="pf-warn">Sin días</span>
                    } @else {
                      —
                    }
                  } @else if (row.weekdays.length === 7) {
                    Todos los días
                  } @else {
                    {{ weekdaysLabel(row.weekdays) }}
                  }
                </td>
                <td class="pf-muted">
                  @if (row.weeksOfCycle.length === 0) {
                    —
                  } @else if (row.weeksOfCycle.length === 4) {
                    Todas
                  } @else {
                    {{ weeksLabel(row.weeksOfCycle) }}
                  }
                </td>
                <td>
                  <span
                    class="pf-badge"
                    [style.color]="'var(' + scheduleTone(row.scheduleStatus) + ')'"
                    >● {{ scheduleLabel(row.scheduleStatus) }}</span
                  >
                </td>
                <td>
                  <ui-status
                    [label]="row.active ? 'Activo' : 'Inactivo'"
                    [status]="row.active ? 'vigente' : 'apagada'"
                  />
                </td>
                <td class="pf-row-menu-cell" (click)="$event.stopPropagation()">
                  <ui-menu label="Asignar, cambiar vendedor, editar horario">
                    @if (row.active) {
                      @if (row.scheduleStatus === 'NO_SELLER') {
                        <button type="button" (click)="assign(row)">Asignar vendedor</button>
                      } @else if (row.scheduleStatus === 'INCOMPLETE') {
                        <button type="button" (click)="editSchedule(row)">Completar horario</button>
                        <button type="button" (click)="assign(row)">Cambiar vendedor</button>
                      } @else {
                        <button type="button" (click)="editSchedule(row)">Editar horario</button>
                        <button type="button" (click)="assign(row)">Cambiar vendedor</button>
                      }
                    }
                    <button type="button" (click)="openCustomer(row)">Ver ficha</button>
                  </ui-menu>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="pf-pager">
          <span class="pf-pager-count">{{ countText() }}</span>
          <div class="pf-pager-nav">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="pf-pager-label"
              >Mostrando {{ pageFrom() }}–{{ pageTo() }} de {{ totalElements() }}</span
            >
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
          <ui-field
            label=""
            type="select"
            [value]="String(size())"
            [options]="sizeOptions"
            (valueChange)="onSizeChange($event)"
          />
        </div>
      }
    </section>
  `,
  styles: [
    `
      .pf-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pf-head {
        margin-bottom: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pf-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 640px;
      }
      .pf-cards {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 24px;
      }
      .pf-card {
        appearance: none;
        text-align: left;
        cursor: pointer;
        font-family: var(--font-sans);
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 14px 16px;
        display: grid;
        gap: 4px;
        min-height: 96px;
        align-content: center;
      }
      .pf-card:hover {
        border-color: var(--accent);
      }
      .pf-card:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .pf-card.selected {
        border-color: var(--accent);
        background: var(--accent-wash);
      }
      .pf-card-label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--ink-muted);
      }
      .pf-card-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .pf-card-value.pf-card-warn {
        color: var(--status-warn);
      }
      .pf-card-value.pf-card-danger {
        color: var(--status-danger);
      }
      .pf-card-value.pf-card-muted {
        color: var(--ink-muted);
      }
      .pf-card-skel {
        display: block;
        width: 40px;
        height: 1em;
        background: var(--faint);
      }
      .pf-card-detail {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pf-card-link {
        color: var(--accent-ink);
        font-weight: 700;
      }
      .pf-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .pf-filters > ui-field {
        flex: 1 1 200px;
        min-width: 160px;
      }
      .pf-filters > ui-typeahead {
        flex: 1 1 200px;
        min-width: 160px;
      }
      .pf-clear {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        padding: 0 0 10px;
      }
      .pf-selection-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 16px;
        background: var(--surface);
        border: 1px solid var(--divider);
        padding: 10px 16px;
        margin-bottom: 12px;
      }
      .pf-selection-hint {
        flex-basis: 100%;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .pf-selection-text {
        font-weight: 700;
        color: var(--ink);
        font-size: 14px;
      }
      .pf-selection-actions {
        display: flex;
        gap: 8px;
        margin-left: auto;
      }
      .pf-table {
        width: 100%;
      }
      .pf-th-check {
        width: 40px;
      }
      .pf-td-check {
        width: 56px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pf-row-num {
        font-size: 11px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
        min-width: 16px;
        text-align: right;
      }
      /* La fila ya muestra el nombre en la columna Cliente: el texto del
         checkbox queda solo para lectores de pantalla, no se repite en pantalla. */
      .pf-td-check ::ng-deep .ui-checkbox-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .pf-row {
        cursor: pointer;
      }
      .pf-row:hover {
        background: var(--faint);
      }
      .pf-row-inactive {
        color: var(--ink-muted);
      }
      .pf-cell-strong {
        font-weight: 800;
      }
      .pf-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .pf-warn {
        color: var(--status-warn);
        font-weight: 700;
      }
      .pf-paused {
        margin-left: 6px;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-muted);
      }
      .pf-badge {
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .pf-row-menu-cell {
        text-align: right;
        width: 44px;
      }
      .pf-pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .pf-pager-count {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pf-pager-nav {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .pf-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .pf-pager ui-field {
        width: 160px;
      }

      @media (max-width: 1100px) {
        .pf-cards {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 767px) {
        .pf-page {
          padding: var(--sp-4);
        }
        .pf-cards {
          grid-template-columns: repeat(2, 1fr);
        }
        .pf-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class PortfolioPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);

  protected String = String;
  protected dateText = dateText;
  protected statusOptions = STATUS_OPTIONS;
  protected scheduleOptions = SCHEDULE_OPTIONS;
  protected sizeOptions = SIZE_OPTIONS;

  qParam = input('', { alias: 'q' });
  statusParam = input('', { alias: 'status' });
  scheduleParam = input('', { alias: 'schedule' });
  userIdParam = input('', { alias: 'userId' });
  userNameParam = input('', { alias: 'userName' });
  pageParam = input('', { alias: 'page' });
  sizeParam = input('', { alias: 'size' });

  protected searchDraft = signal('');
  protected statusFilter = signal<PortfolioStatusFilter>('ACTIVE');
  protected scheduleFilter = signal<PortfolioScheduleFilter>('ALL');
  protected vendorFilter = signal<UiLookupItem | null>(null);
  protected page = signal(0);
  protected size = signal(20);

  protected rows = signal<PortfolioCustomerRow[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected summary = signal<PortfolioSummary | null>(null);
  protected absentVendors = signal<number | null>(null);

  /** customerId → datos mínimos para el modal de lote; persiste entre páginas. */
  protected selected = signal<Map<number, SelectedCustomer>>(new Map());

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected hasActiveFilters = computed(
    () =>
      !!this.qParam() ||
      (this.statusParam() || 'ACTIVE') !== 'ACTIVE' ||
      (this.scheduleParam() || 'ALL') !== 'ALL' ||
      !!this.userIdParam(),
  );

  protected pageAllSelected = computed(() => {
    const active = this.rows().filter((r) => r.active);
    if (active.length === 0) return false;
    const sel = this.selected();
    return active.every((r) => sel.has(r.customerId));
  });
  protected pageIndeterminate = computed(() => {
    const active = this.rows().filter((r) => r.active);
    const sel = this.selected();
    const selectedOnPage = active.filter((r) => sel.has(r.customerId)).length;
    return selectedOnPage > 0 && selectedOnPage < active.length;
  });
  protected showPageHint = computed(
    () => this.pageAllSelected() && this.totalElements() > this.rows().length,
  );

  protected pageFrom = computed(() =>
    this.totalElements() === 0 ? 0 : this.page() * this.size() + 1,
  );
  protected pageTo = computed(() =>
    Math.min(this.totalElements(), (this.page() + 1) * this.size()),
  );

  /** Clave de los filtros (sin página ni tamaño): cambiar cualquiera de estos limpia la selección — doc 68, sección 5.3. */
  private lastFilterKey = '';

  private seedEffect = effect(() => {
    const q = this.qParam() ?? '';
    const status = (this.statusParam() || 'ACTIVE') as PortfolioStatusFilter;
    const schedule = (this.scheduleParam() || 'ALL') as PortfolioScheduleFilter;
    const userId = this.userIdParam() ?? '';
    const userName = this.userNameParam() ?? '';
    const page = this.pageParam() ?? '';
    const size = this.sizeParam() ?? '';
    untracked(() => {
      this.searchDraft.set(q);
      this.statusFilter.set(status);
      this.scheduleFilter.set(schedule);
      this.vendorFilter.set(userId && userName ? { id: Number(userId), name: userName } : null);
      this.page.set(page ? Number(page) : 0);
      this.size.set(size && Number(size) > 0 ? Number(size) : 20);

      const filterKey = `${q}|${status}|${schedule}|${userId}`;
      if (filterKey !== this.lastFilterKey) {
        this.lastFilterKey = filterKey;
        this.selected.set(new Map());
      }
      this.load();
    });
  });

  constructor() {
    this.loadSummary();
    this.assignmentSvc.vendorsWithoutRouteToday().subscribe({
      next: (list) => this.absentVendors.set(list.length),
      error: () => this.absentVendors.set(null),
    });

    toObservable(this.searchDraft)
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((text) => {
        const trimmed = text.trim();
        if (trimmed.length === 1) return;
        if (trimmed === (this.qParam() ?? '')) return;
        this.navigateWithFilters({ q: trimmed, page: 0 });
      });
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 cliente' : `${n} clientes`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc
      .portfolio({
        q: this.searchDraft().trim().length >= 2 ? this.searchDraft().trim() : undefined,
        status: this.statusFilter(),
        schedule: this.scheduleFilter(),
        userId: this.vendorFilter()?.id,
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

  loadSummary() {
    this.assignmentSvc.portfolioSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  private refreshAll() {
    this.load();
    this.loadSummary();
  }

  protected weekdaysLabel(weekdays: number[]): string {
    return [...weekdays]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS[d] ?? d)
      .join(', ');
  }

  protected weeksLabel(weeks: number[]): string {
    return [...weeks]
      .sort((a, b) => a - b)
      .map((w) => `S${w}`)
      .join(', ');
  }

  protected scheduleLabel(status: PortfolioScheduleStatus): string {
    return SCHEDULE_STATUS_LABEL[status] ?? status;
  }

  protected scheduleTone(status: PortfolioScheduleStatus): string {
    return SCHEDULE_STATUS_TONE[status] ?? '--ink-muted';
  }

  protected cardSelected(
    status: PortfolioStatusFilter,
    schedule: PortfolioScheduleFilter,
  ): boolean {
    return (
      !this.qParam() &&
      !this.userIdParam() &&
      (this.statusParam() || 'ACTIVE') === status &&
      (this.scheduleParam() || 'ALL') === schedule
    );
  }

  protected selectCard(status: PortfolioStatusFilter, schedule: PortfolioScheduleFilter) {
    this.navigateWithFilters({ q: '', status, schedule, userId: '', userName: '', page: 0 });
  }

  protected goToAbsences() {
    this.router.navigateByUrl('/asignaciones/ausencias');
  }

  protected onStatusChange(value: string) {
    this.navigateWithFilters({ status: value as PortfolioStatusFilter, page: 0 });
  }

  protected onScheduleChange(value: string) {
    this.navigateWithFilters({ schedule: value as PortfolioScheduleFilter, page: 0 });
  }

  protected onVendorChange(item: UiLookupItem | null) {
    this.navigateWithFilters({
      userId: item ? String(item.id) : '',
      userName: item ? item.name : '',
      page: 0,
    });
  }

  protected onSizeChange(value: string) {
    this.navigateWithFilters({ size: Number(value) || 20, page: 0 });
  }

  protected clearFilters() {
    this.navigateWithFilters({
      q: '',
      status: 'ACTIVE',
      schedule: 'ALL',
      userId: '',
      userName: '',
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

  // — Selección —

  protected isSelected(customerId: number): boolean {
    return this.selected().has(customerId);
  }

  protected atMaxSelection(): boolean {
    return this.selected().size >= MAX_BULK;
  }

  protected checkboxTitle(row: PortfolioCustomerRow): string {
    if (!row.active) return 'Cliente inactivo: actívalo desde su ficha';
    if (!this.isSelected(row.customerId) && this.atMaxSelection()) {
      return `Máximo ${MAX_BULK} clientes por asignación en lote`;
    }
    return '';
  }

  protected toggleRow(row: PortfolioCustomerRow) {
    if (!row.active) return;
    const map = new Map(this.selected());
    if (map.has(row.customerId)) {
      map.delete(row.customerId);
    } else {
      if (map.size >= MAX_BULK) return;
      map.set(row.customerId, {
        customerId: row.customerId,
        code: row.code,
        businessName: row.businessName,
        salespersonId: row.salespersonId,
        salespersonName: row.salespersonName,
      });
    }
    this.selected.set(map);
  }

  protected toggleSelectPage() {
    const active = this.rows().filter((r) => r.active);
    const map = new Map(this.selected());
    if (this.pageAllSelected()) {
      for (const r of active) map.delete(r.customerId);
    } else {
      for (const r of active) {
        if (map.size >= MAX_BULK && !map.has(r.customerId)) break;
        map.set(r.customerId, {
          customerId: r.customerId,
          code: r.code,
          businessName: r.businessName,
          salespersonId: r.salespersonId,
          salespersonName: r.salespersonName,
        });
      }
    }
    this.selected.set(map);
  }

  protected clearSelection() {
    this.selected.set(new Map());
  }

  protected openBulkAssign() {
    const customers = [...this.selected().values()];
    if (customers.length === 0) return;
    this.dialog
      .open<BulkAssignDialog, BulkAssignDialogData, boolean>(BulkAssignDialog, {
        data: { customers },
        width: '560px',
      })
      .afterClosed()
      .subscribe((applied) => {
        if (applied) {
          this.clearSelection();
          this.refreshAll();
        }
      });
  }

  // — Fila —

  protected openCustomer(row: PortfolioCustomerRow) {
    this.router.navigate(['/clientes', row.customerId]);
  }

  protected assign(row: PortfolioCustomerRow) {
    this.dialog
      .open(CreateAssignmentDialog, {
        data: { fixedCustomer: { id: row.customerId, name: row.businessName, code: row.code } },
        width: '520px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.refreshAll());
  }

  protected editSchedule(row: PortfolioCustomerRow) {
    if (!row.assignmentId) return;
    this.dialog
      .open(ScheduleDialog, {
        data: {
          assignmentId: row.assignmentId,
          customerName: row.businessName,
          vendorLabel: row.salespersonName
            ? `${row.salespersonCode} ${row.salespersonName}`
            : undefined,
          weekdays: row.weekdays,
          weeksOfCycle: row.weeksOfCycle,
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.refreshAll());
  }

  private navigateWithFilters(override: FilterOverride) {
    const next = {
      q: override.q ?? this.searchDraft(),
      status: override.status ?? this.statusFilter(),
      schedule: override.schedule ?? this.scheduleFilter(),
      userId:
        override.userId ?? (this.vendorFilter()?.id != null ? String(this.vendorFilter()!.id) : ''),
      userName: override.userName ?? this.vendorFilter()?.name ?? '',
      page: override.page ?? this.page(),
      size: override.size ?? this.size(),
    };
    this.router.navigate([], {
      queryParams: {
        q: next.q || null,
        status: next.status !== 'ACTIVE' ? next.status : null,
        schedule: next.schedule !== 'ALL' ? next.schedule : null,
        userId: next.userId || null,
        userName: next.userId ? next.userName || null : null,
        page: next.page || null,
        size: next.size !== 20 ? next.size : null,
      },
    });
  }
}
