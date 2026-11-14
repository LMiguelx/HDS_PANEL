import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, fromEvent, interval, merge, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiWarehouseSelect } from '../../shared/ui/warehouse-select/warehouse-select';
import { InventoryModuleTabs } from './ui/module-tabs';
import { StockCountAdminService } from './stock-count-admin';
import { BrandCountBoardRow } from './domain/stock-count.models';
import {
  BoardRowDisplayStatus,
  boardRowDisplayStatus,
  boardRowSortKey,
  boardRowStatusLabel,
  boardRowStatusTone,
  displayStatusToneVar,
  relativeTimeText,
  shortDateTimeText,
  BADGE_TONE_VAR,
} from './domain/stock-count.format';

const REFRESH_MS = 600_000; // 10 minutos — doc 82, sección 6.2

interface BoardCard {
  key: BoardRowDisplayStatus;
  label: string;
}

const CARDS: BoardCard[] = [
  { key: 'COUNTING', label: 'Contando' },
  { key: 'IDLE', label: 'Sin actividad' },
  { key: 'RELEASED', label: 'Liberadas' },
  { key: 'CLOSED', label: 'Finalizadas' },
  { key: 'FREE', label: 'Libres' },
];

/**
 * Pizarra de Conteo de inventario — GET /api/stock-counts/board — doc 82,
 * sección 6.2. Solo lectura: supervisión ve el avance, no cuenta ni libera.
 */
@Component({
  selector: 'app-stock-count-board',
  imports: [UiButton, UiField, UiEmpty, UiWarehouseSelect, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="scb-page">
      <div class="scb-head">
        <div>
          <h1>Conteo de inventario</h1>
          <p class="scb-sub">Avance del inventario por marca. Se actualiza cada 10 minutos.</p>
        </div>
      </div>

      <div class="scb-toolbar">
        <ui-warehouse-select
          mode="all"
          storageKey="stock-count-board"
          [value]="warehouseId()"
          (valueChange)="onWarehouseIdChange($event)"
        />
        <div class="scb-toolbar-actions">
          @if (updatedAt()) {
            <span class="scb-updated">Actualizado {{ updatedAtText() }}</span>
          }
          <button uiButton variant="ghost" [loading]="loading()" (click)="refresh()">
            ↻ Actualizar
          </button>
        </div>
      </div>

      @if (!warehouseId()) {
        <ui-empty title="Elige un almacén" body="Selecciona el almacén para ver su conteo." />
      } @else if (loading() && rows().length === 0 && !error() && !notFound()) {
        <div class="scb-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (notFound()) {
        <ui-empty
          variant="error"
          title="El almacén no existe o está inactivo"
          [body]="errorDetail() || ''"
          actionLabel="Elegir otro almacén"
          (action)="goToFirstWarehouse()"
        />
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la pizarra."
          actionLabel="Reintentar"
          (action)="refresh()"
        />
      } @else if (rows().length === 0) {
        <ui-empty title="Este almacén todavía no tiene productos asignados para contar" body="" />
      } @else {
        <div class="scb-cards">
          <button
            type="button"
            class="scb-card"
            [class.scb-card-on]="activeCard() === null"
            (click)="activeCard.set(null)"
          >
            <span class="scb-card-value">{{ rows().length }}</span>
            <span class="scb-card-label">Marcas</span>
          </button>
          @for (c of cards; track c.key) {
            <button
              type="button"
              class="scb-card"
              [class.scb-card-on]="activeCard() === c.key"
              (click)="toggleCard(c.key)"
            >
              <span class="scb-card-value" [style.color]="cardToneVar(c.key)">{{
                countFor(c.key)
              }}</span>
              <span class="scb-card-label">{{ c.label }}</span>
            </button>
          }
          <div class="scb-card scb-card-static">
            <span class="scb-card-value">{{ progressPercentText() }}</span>
            <span class="scb-card-label">Avance total</span>
          </div>
        </div>

        <div class="scb-filters">
          <ui-field label="Buscar marca" [(value)]="q" placeholder="Nombre de la marca" />
          <ui-field
            label="Estado"
            type="select"
            [options]="statusOptions"
            [value]="activeCard() ?? ''"
            (valueChange)="onStatusFilterChange($event)"
          />
        </div>

        <div class="scb-table-wrap">
          <table class="ui-table-grid scb-table">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Avance</th>
                <th>Inicio</th>
                <th>Última actividad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of visibleRows(); track row.brandId) {
                <tr
                  class="scb-row"
                  [class.scb-row-clickable]="row.stockCountId != null"
                  (click)="openCount(row)"
                >
                  <td class="scb-cell-strong">{{ row.brandName }}</td>
                  <td>
                    <span class="scb-badge" [style.color]="rowToneVar(row)">{{
                      boardRowStatusLabel(row)
                    }}</span>
                  </td>
                  <td class="scb-muted">
                    {{
                      row.userName ??
                        (row.status === 'RELEASED' ? 'Sin responsable · con avance' : '—')
                    }}
                  </td>
                  <td>
                    @if (row.status === 'FREE') {
                      <span class="scb-muted">—</span>
                    } @else {
                      <div class="scb-progress">
                        <div class="scb-progress-bar">
                          <div class="scb-progress-fill" [style.width.%]="progressPct(row)"></div>
                        </div>
                        <span class="scb-progress-text"
                          >{{ row.countedProducts }} / {{ row.totalProducts }} ({{
                            progressPct(row)
                          }}%)</span
                        >
                      </div>
                    }
                  </td>
                  <td class="scb-muted">{{ shortDateTimeText(row.startedAt) }}</td>
                  <td class="scb-muted">
                    {{ row.lastActivityAt ? relativeTimeText(row.lastActivityAt) : '—' }}
                  </td>
                  <td class="scb-chevron">{{ row.stockCountId != null ? '›' : '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .scb-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .scb-head {
        margin-top: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .scb-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .scb-toolbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin: 20px 0;
      }
      .scb-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .scb-updated {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .scb-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .scb-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }
      .scb-card {
        flex: 1 1 120px;
        display: grid;
        gap: 2px;
        appearance: none;
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 12px 14px;
        cursor: pointer;
        text-align: left;
        font-family: var(--font-sans);
      }
      .scb-card-static {
        cursor: default;
      }
      .scb-card-on {
        border-color: var(--accent);
        background: var(--accent-wash);
      }
      .scb-card-value {
        font-size: 22px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .scb-card-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .scb-filters {
        display: grid;
        grid-template-columns: minmax(200px, 320px) 180px;
        gap: 12px;
        margin-bottom: 16px;
      }
      .scb-table-wrap {
        overflow-x: auto;
      }
      .scb-table {
        width: 100%;
        min-width: 900px;
      }
      .scb-cell-strong {
        font-weight: 800;
      }
      .scb-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .scb-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .scb-progress {
        display: grid;
        gap: 4px;
        min-width: 160px;
      }
      .scb-progress-bar {
        height: 6px;
        background: var(--faint);
      }
      .scb-progress-fill {
        height: 100%;
        background: var(--accent);
      }
      .scb-progress-text {
        font-size: 12px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .scb-row-clickable {
        cursor: pointer;
      }
      .scb-row-clickable:hover {
        background: var(--faint);
      }
      .scb-chevron {
        text-align: right;
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .scb-page {
          padding: var(--sp-4);
        }
        .scb-filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StockCountBoardPage {
  private svc = inject(StockCountAdminService);
  private router = inject(Router);

  protected boardRowStatusLabel = boardRowStatusLabel;
  protected rowToneVar = (row: BrandCountBoardRow) =>
    `var(${BADGE_TONE_VAR[boardRowStatusTone(row)]})`;
  protected shortDateTimeText = shortDateTimeText;
  protected relativeTimeText = relativeTimeText;
  protected cards = CARDS;
  protected statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'COUNTING', label: 'Contando' },
    { value: 'IDLE', label: 'Sin actividad' },
    { value: 'RELEASED', label: 'Liberadas' },
    { value: 'CLOSED', label: 'Finalizadas' },
    { value: 'FREE', label: 'Libres' },
  ];

  protected warehouseId = signal<number | null>(null);
  protected q = signal('');
  protected activeCard = signal<BoardRowDisplayStatus | null>(null);

  protected rows = signal<BrandCountBoardRow[]>([]);
  protected loading = signal(false);
  protected error = signal(false);
  protected notFound = signal(false);
  protected errorDetail = signal('');
  protected updatedAt = signal<Date | null>(null);

  protected visibleRows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const card = this.activeCard();
    return this.rows()
      .filter((r) => !q || r.brandName.toLowerCase().includes(q))
      .filter((r) => !card || boardRowDisplayStatus(r) === card)
      .sort((a, b) => {
        const [ka, na] = boardRowSortKey(a);
        const [kb, nb] = boardRowSortKey(b);
        return ka !== kb ? ka - kb : na.localeCompare(nb);
      });
  });

  private manualRefresh$ = new Subject<void>();

  constructor() {
    const warehouseChanged$ = toObservable(this.warehouseId).pipe(
      filter((id) => id != null),
      map(() => undefined),
    );
    const heartbeat$ = interval(REFRESH_MS).pipe(
      filter(() => document.visibilityState === 'visible' && this.warehouseId() != null),
      map(() => undefined),
    );
    const visibilityRegained$ = fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible' && this.warehouseId() != null),
      map(() => undefined),
    );

    merge(warehouseChanged$, this.manualRefresh$, heartbeat$, visibilityRegained$)
      .pipe(
        switchMap(() => this.load()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected onWarehouseIdChange(id: number | null) {
    this.warehouseId.set(id);
    this.activeCard.set(null);
    this.q.set('');
  }

  protected refresh() {
    this.manualRefresh$.next();
  }

  protected toggleCard(key: BoardRowDisplayStatus) {
    this.activeCard.set(this.activeCard() === key ? null : key);
  }

  protected onStatusFilterChange(value: string) {
    this.activeCard.set((value as BoardRowDisplayStatus) || null);
  }

  protected cardToneVar = displayStatusToneVar;

  protected countFor(key: BoardRowDisplayStatus): number {
    return this.rows().filter((r) => boardRowDisplayStatus(r) === key).length;
  }

  protected progressPct(row: BrandCountBoardRow): number {
    if (row.totalProducts === 0) return 0;
    return Math.round((row.countedProducts / row.totalProducts) * 100);
  }

  protected progressPercentText(): string {
    const active = this.rows().filter((r) => r.status !== 'FREE');
    const totalCounted = active.reduce((s, r) => s + r.countedProducts, 0);
    const totalProducts = active.reduce((s, r) => s + r.totalProducts, 0);
    if (totalProducts === 0) return '—';
    return `${Math.round((totalCounted / totalProducts) * 100)}%`;
  }

  protected updatedAtText(): string {
    const d = this.updatedAt();
    if (!d) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  protected openCount(row: BrandCountBoardRow) {
    if (row.stockCountId == null) return;
    this.router.navigate(['/inventario/conteo', row.stockCountId]);
  }

  protected goToFirstWarehouse() {
    this.notFound.set(false);
    this.warehouseId.set(null);
  }

  private load() {
    const warehouseId = this.warehouseId();
    if (!warehouseId) return of(null);
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.errorDetail.set('');
    return this.svc.board(warehouseId).pipe(
      map((list) => {
        this.rows.set(list);
        this.loading.set(false);
        this.updatedAt.set(new Date());
      }),
      catchError((err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
          this.errorDetail.set(err?.error?.detail || '');
        } else {
          this.error.set(true);
        }
        return of(null);
      }),
    );
  }
}
