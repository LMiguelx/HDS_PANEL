import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UserFormDialog } from './ui/user-form-dialog';
import { UserAdminService } from './user-admin';
import { UserSummaryCounts, UserSummaryView } from '../../shared/models/user.models';
import { jornadaTodayText, lastLoginText, rolesText } from './user-format';

const ACTIVE_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];
const ON_ROUTE_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'En jornada hoy' },
  { value: 'false', label: 'Sin jornada hoy' },
];
const SIZE_OPTIONS: UiFieldOption[] = [
  { value: '20', label: '20 por página' },
  { value: '50', label: '50 por página' },
  { value: '100', label: '100 por página' },
];

interface FilterOverride {
  q?: string;
  roleCode?: string;
  active?: string;
  onRouteToday?: string;
  page?: number;
  size?: number;
}

/**
 * Listado de usuarios — doc 66, sección 5. Filtros en el servidor con
 * estado en la URL: la URL es la fuente de verdad (un cambio de filtro
 * navega; la navegación es lo que dispara la carga), así el enlace del
 * Inicio abre la pantalla ya filtrada y el botón Atrás del navegador
 * conserva el filtro anterior.
 */
@Component({
  selector: 'app-user-list',
  imports: [RouterLink, UiButton, UiField, UiTable, UiEmpty],
  template: `
    <section class="ul-page">
      <div class="ul-head">
        <div>
          <h1>Usuarios</h1>
          @if (summary(); as s) {
            <p class="ul-sub">
              {{ s.total }} usuario{{ s.total === 1 ? '' : 's' }} · {{ s.active }} activo{{
                s.active === 1 ? '' : 's'
              }}
              · {{ s.onRouteToday }} en jornada hoy
            </p>
          } @else {
            <p class="ul-sub">{{ countText() }}</p>
          }
        </div>
        <button uiButton variant="primary" (click)="openCreate()">Nuevo usuario</button>
      </div>

      @if (summary(); as s) {
        <div class="ul-role-chips">
          <button type="button" class="ul-chip" [class.on]="!roleFilter()" (click)="selectRole('')">
            Todos <span class="ul-chip-count">{{ s.total }}</span>
          </button>
          @for (r of visibleRoles(s); track r.roleCode) {
            <button
              type="button"
              class="ul-chip"
              [class.on]="roleFilter() === r.roleCode"
              (click)="selectRole(r.roleCode)"
            >
              {{ r.roleName }} <span class="ul-chip-count">{{ r.total }}</span>
              @if (r.onRouteToday > 0) {
                <span class="ul-chip-sub">· {{ r.onRouteToday }} en jornada</span>
              }
            </button>
          }
        </div>
      }

      <div class="ul-filters">
        <ui-field
          label="Buscar"
          icon="search"
          placeholder="Nombre, código o usuario"
          [(value)]="searchDraft"
        />
        <ui-field
          label="Estado"
          type="select"
          [value]="activeFilter()"
          (valueChange)="onActiveChange($event)"
          [options]="activeOptions"
        />
        <ui-field
          label="Jornada"
          type="select"
          [value]="onRouteTodayFilter()"
          (valueChange)="onRouteTodayChange($event)"
          [options]="onRouteOptions"
        />
        @if (hasActiveFilters()) {
          <button uiButton variant="ghost" size="sm" (click)="clearFilters()">
            Limpiar filtros
          </button>
        }
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los usuarios."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          @if (hasActiveFilters()) {
            <ui-empty
              title="Ningún usuario coincide con los filtros"
              actionLabel="Limpiar filtros"
              (action)="clearFilters()"
            />
          } @else {
            <ui-empty title="Sin usuarios" body="Todavía no hay otros usuarios." />
          }
        </div>

        <table class="ui-table-grid ul-table-desktop">
          <thead>
            <tr>
              <th>Código</th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>Jornada hoy</th>
              <th>Último ingreso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of rows(); track u.userId) {
              <tr [routerLink]="['/usuarios', u.userId]" class="ul-row">
                <td class="ul-muted">{{ u.code }}</td>
                <td class="ul-cell-strong">{{ u.username }}</td>
                <td>{{ u.fullName }}</td>
                <td class="ul-muted" [title]="rolesOf(u).title">{{ rolesOf(u).text }}</td>
                <td>
                  <span class="ul-status" [class.ul-status-off]="!u.active">{{
                    u.active ? 'Activo' : 'Inactivo'
                  }}</span>
                </td>
                <td>
                  <span
                    class="ul-jornada"
                    [class.ul-jornada-active]="jornadaOf(u).state === 'active'"
                    [class.ul-jornada-muted]="jornadaOf(u).state !== 'active'"
                  >
                    @if (jornadaOf(u).state === 'active') {
                      <span class="ul-jornada-dot"></span>
                    }
                    {{ jornadaOf(u).text }}
                  </span>
                </td>
                <td class="ul-muted" [class.ul-never]="!u.lastLoginAt">
                  {{ lastLoginText(u.lastLoginAt) }}
                </td>
                <td class="ul-row-action">
                  <button
                    uiButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/usuarios', u.userId]"
                    (click)="$event.stopPropagation()"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="ul-cards-mobile">
          @for (u of rows(); track u.userId) {
            <a [routerLink]="['/usuarios', u.userId]" class="ul-card-mobile">
              <div class="ul-card-mobile-head">
                <span class="ul-card-mobile-name">{{ u.fullName }}</span>
                <span class="ul-status" [class.ul-status-off]="!u.active">{{
                  u.active ? 'Activo' : 'Inactivo'
                }}</span>
              </div>
              <div class="ul-muted">{{ u.username }} · {{ u.code }}</div>
              <div class="ul-muted">{{ rolesOf(u).text }}</div>
              <div class="ul-muted">
                {{ jornadaOf(u).text }} · {{ lastLoginText(u.lastLoginAt) }}
              </div>
            </a>
          }
        </div>
      </ui-table>

      @if (!loading() && !error() && rows().length > 0) {
        <div class="ul-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="ul-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() + 1 >= totalPages()"
            (click)="nextPage()"
          >
            Siguiente
          </button>
          <ui-field
            label="Por página"
            type="select"
            class="ul-size-field"
            [value]="String(size())"
            (valueChange)="onSizeChange($event)"
            [options]="sizeOptions"
          />
        </div>
      }
    </section>
  `,
  styles: [
    `
      .ul-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ul-head {
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
      .ul-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ul-role-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
      }
      .ul-chip {
        appearance: none;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        font-family: var(--font-sans);
        font-weight: 700;
        font-size: 13px;
        padding: 6px 14px;
        border-radius: var(--radius-pill);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .ul-chip.on {
        background: var(--accent-wash);
        border-color: var(--accent);
        color: var(--accent-ink);
      }
      .ul-chip-count {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .ul-chip-sub {
        color: var(--ink-muted);
        font-weight: 600;
      }
      .ul-chip.on .ul-chip-sub {
        color: var(--accent-ink);
      }
      .ul-filters {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        margin: 18px 0 20px;
        padding-bottom: 18px;
        border-bottom: var(--border-hair);
        flex-wrap: wrap;
      }
      .ul-filters ui-field:first-child {
        width: 280px;
      }
      .ul-filters ui-field {
        width: 170px;
      }
      .ul-cell-strong {
        font-weight: 800;
      }
      .ul-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ul-never {
        color: var(--ink-muted);
      }
      .ul-row {
        cursor: pointer;
      }
      .ul-row:hover {
        background: var(--faint);
      }
      .ul-status {
        display: inline-flex;
        align-items: center;
        font-size: 12px;
        font-weight: 800;
        color: var(--success);
      }
      .ul-status-off {
        color: var(--ink-muted);
      }
      .ul-jornada {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }
      .ul-jornada-active {
        color: var(--success);
        font-weight: 700;
      }
      .ul-jornada-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
      }
      .ul-jornada-muted {
        color: var(--ink-muted);
      }
      .ul-row-action {
        text-align: right;
      }
      .ul-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      .ul-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .ul-size-field {
        width: 150px;
      }
      .ul-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ul-page {
          padding: var(--sp-4);
        }
        .ul-filters ui-field:first-child,
        .ul-filters ui-field {
          width: 100%;
        }
        .ul-table-desktop {
          display: none;
        }
        .ul-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ul-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .ul-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ul-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class UserListPage {
  private userSvc = inject(UserAdminService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);

  qParam = input('', { alias: 'q' });
  roleCodeParam = input('', { alias: 'roleCode' });
  activeParam = input('', { alias: 'active' });
  onRouteTodayParam = input('', { alias: 'onRouteToday' });
  pageParam = input('', { alias: 'page' });
  sizeParam = input('', { alias: 'size' });

  protected activeOptions = ACTIVE_OPTIONS;
  protected onRouteOptions = ON_ROUTE_OPTIONS;
  protected sizeOptions = SIZE_OPTIONS;
  protected String = String;

  protected rows = signal<UserSummaryView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected summary = signal<UserSummaryCounts | null>(null);

  /** Texto tal como se escribe; se navega con debounce (sección 5.2). */
  protected searchDraft = signal('');
  protected roleFilter = signal('');
  protected activeFilter = signal('');
  protected onRouteTodayFilter = signal('');
  protected page = signal(0);
  protected size = signal(20);

  protected hasActiveFilters = computed(
    () =>
      !!this.roleCodeParam() ||
      !!this.activeParam() ||
      !!this.onRouteTodayParam() ||
      !!this.qParam(),
  );

  protected rolesOf = (u: UserSummaryView) => rolesText(u.roles);
  protected jornadaOf = (u: UserSummaryView) => jornadaTodayText(u.routeStartedAt, u.routeEndedAt);
  protected lastLoginText = lastLoginText;

  protected visibleRoles(s: UserSummaryCounts) {
    return s.byRole.filter((r) => r.total > 0);
  }

  constructor() {
    this.loadSummary();

    // La URL es la fuente de verdad: cada navegación (propia o del botón
    // Atrás) actualiza el estado local y vuelve a pedir la página.
    effect(() => {
      const q = this.qParam();
      const roleCode = this.roleCodeParam();
      const active = this.activeParam();
      const onRouteToday = this.onRouteTodayParam();
      const page = this.pageParam();
      const size = this.sizeParam();
      untracked(() => {
        this.searchDraft.set(q);
        this.roleFilter.set(roleCode);
        this.activeFilter.set(active);
        this.onRouteTodayFilter.set(onRouteToday);
        this.page.set(page ? Number(page) : 0);
        this.size.set(size && Number(size) > 0 ? Number(size) : 20);
        this.load();
      });
    });

    // Buscar — debounce de 300 ms, mínimo 2 caracteres (sección 5.2).
    toObservable(this.searchDraft)
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((text) => {
        const trimmed = text.trim();
        if (trimmed.length === 1) return;
        if (trimmed === this.qParam()) return;
        this.navigateWithFilters({ q: trimmed, page: 0 });
      });
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 usuario' : `${n} usuarios`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.userSvc
      .list({
        q: this.searchDraft().trim().length >= 2 ? this.searchDraft().trim() : undefined,
        roleCode: this.roleFilter() || undefined,
        active:
          this.activeFilter() === 'true'
            ? true
            : this.activeFilter() === 'false'
              ? false
              : undefined,
        onRouteToday:
          this.onRouteTodayFilter() === 'true'
            ? true
            : this.onRouteTodayFilter() === 'false'
              ? false
              : undefined,
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
    this.userSvc.summary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => undefined,
    });
  }

  protected selectRole(roleCode: string) {
    this.navigateWithFilters({ roleCode, page: 0 });
  }

  protected onActiveChange(value: string) {
    this.navigateWithFilters({ active: value, page: 0 });
  }

  protected onRouteTodayChange(value: string) {
    this.navigateWithFilters({ onRouteToday: value, page: 0 });
  }

  protected onSizeChange(value: string) {
    this.navigateWithFilters({ size: Number(value) || 20, page: 0 });
  }

  protected clearFilters() {
    this.navigateWithFilters({ q: '', roleCode: '', active: '', onRouteToday: '', page: 0 });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.navigateWithFilters({ page: this.page() - 1 });
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.navigateWithFilters({ page: this.page() + 1 });
  }

  protected openCreate() {
    this.dialog
      .open<UserFormDialog, unknown, { userId: number } | false>(UserFormDialog, { width: '680px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
          this.loadSummary();
        }
      });
  }

  private navigateWithFilters(override: FilterOverride) {
    const next = {
      q: override.q ?? this.searchDraft(),
      roleCode: override.roleCode ?? this.roleFilter(),
      active: override.active ?? this.activeFilter(),
      onRouteToday: override.onRouteToday ?? this.onRouteTodayFilter(),
      page: override.page ?? this.page(),
      size: override.size ?? this.size(),
    };
    this.router.navigate([], {
      queryParams: {
        q: next.q || null,
        roleCode: next.roleCode || null,
        active: next.active || null,
        onRouteToday: next.onRouteToday || null,
        page: next.page || null,
        size: next.size !== 20 ? next.size : null,
      },
    });
  }
}
