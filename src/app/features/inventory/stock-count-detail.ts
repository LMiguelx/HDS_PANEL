import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, interval, merge, of } from 'rxjs';
import { catchError, filter, map, startWith, switchMap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { ExportFormat } from '../../shared/utils/export/export.models';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ToastService } from '../../core/ui/toast';
import { StockCountAdminService } from './stock-count-admin';
import {
  CountLineStatus,
  CountProductLine,
  StockCountDetailResponse,
} from './domain/stock-count.models';
import { stockCountExportTable } from './domain/stock-count.columns';
import {
  countedText,
  countNumberText,
  entryMethodLabel,
  headerStatusLabel,
  headerStatusTone,
  lineStatusColor,
  lineStatusLabel,
  presentationText,
  relativeTimeText,
  shortDateTimeText,
  BADGE_TONE_VAR,
} from './domain/stock-count.format';

const REFRESH_MS = 600_000; // 10 minutos — doc 82, sección 6.3

type TabKey = 'PENDING' | 'DONE' | 'NOT_FOUND' | 'ALL';

/**
 * Detalle de un conteo (solo lectura) — GET /api/stock-counts/{id} — doc 82,
 * sección 6.3. Sin botones de acción: contar, liberar y finalizar son
 * exclusivos del almacenero en la app.
 */
@Component({
  selector: 'app-stock-count-detail',
  imports: [UiButton, UiField, UiEmpty, UiExportMenu],
  template: `
    <section class="scd-page">
      @if (loading() && !detail()) {
        <div class="scd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (notFound()) {
        <ui-empty
          title="El conteo no existe"
          actionLabel="Volver a la pizarra"
          (action)="goBack()"
        />
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el conteo."
          actionLabel="Reintentar"
          (action)="refresh()"
        />
      } @else if (detail(); as d) {
        <button type="button" class="scd-back" (click)="goBack()">← Conteo de inventario</button>

        <div class="scd-head">
          <div class="scd-title-row">
            <h1>Conteo N.° {{ d.header.stockCountId }} · {{ d.header.brandName }}</h1>
            <span class="scd-badge" [style.color]="headerToneVar(d.header, d.active)">{{
              headerStatusLabel(d.header, d.active)
            }}</span>
          </div>
          <p class="scd-meta">
            @if (d.header.userName) {
              Iniciado por {{ d.header.userName }} el {{ shortDateTimeText(d.header.startedAt) }}
              · Última actividad
              {{ d.header.lastActivityAt ? relativeTimeText(d.header.lastActivityAt) : '—' }}
            } @else {
              Liberado · sin responsable
            }
            · Almacén {{ d.header.warehouseName }}
          </p>
        </div>

        <div class="scd-banner">
          Vista de supervisión: el conteo lo realiza almacén desde la app
        </div>

        <div class="scd-blocks">
          <div class="scd-block">
            <div class="scd-block-title">Conteo</div>
            <div class="scd-ro-row">
              <span>Marca</span><strong>{{ d.header.brandName }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>Responsable</span><strong>{{ d.header.userName ?? '—' }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>Inicio</span><strong>{{ shortDateTimeText(d.header.startedAt) }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>Finalizado</span><strong>{{ shortDateTimeText(d.header.closedAt) }}</strong>
            </div>
          </div>

          <div class="scd-block">
            <div class="scd-block-title">Avance</div>
            <div class="scd-ro-row">
              <span>Productos</span><strong>{{ d.summary.totalProducts }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>Pendientes</span><strong>{{ d.summary.pending }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>Realizados</span><strong>{{ d.summary.done }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>No encontrados</span>
              <strong [class.scd-danger]="d.summary.notFound > 0">{{ d.summary.notFound }}</strong>
            </div>
            <div class="scd-progress">
              <div class="scd-progress-bar">
                <div class="scd-progress-fill" [style.width.%]="progressPct(d)"></div>
              </div>
              <span class="scd-progress-text"
                >{{ d.header.countedProducts }} / {{ d.header.totalProducts }} ({{
                  progressPct(d)
                }}%)</span
              >
            </div>
          </div>

          <div class="scd-block">
            <div class="scd-block-title">Almacén</div>
            <div class="scd-ro-row">
              <span>Almacén</span><strong>{{ d.header.warehouseName }}</strong>
            </div>
            <div class="scd-ro-row">
              <span>ERP</span><strong>{{ erpStatusText(d.header) }}</strong>
            </div>
          </div>
        </div>

        <div class="scd-toolbar">
          <div class="scd-tabs">
            @for (t of tabs(); track t.key) {
              <button
                type="button"
                class="scd-tab"
                [class.scd-tab-on]="activeTab() === t.key"
                (click)="activeTab.set(t.key)"
              >
                {{ t.label }} ({{ t.count }})
              </button>
            }
          </div>
          <div class="scd-toolbar-actions">
            <ui-field label="Buscar" [(value)]="q" placeholder="Código o nombre" />
            <ui-export-menu
              [formats]="['xlsx', 'pdf']"
              [disabled]="filteredLines().length === 0"
              [busy]="exporting()"
              (export)="exportTable($event)"
            />
          </div>
        </div>

        <div class="scd-table-wrap">
          <table class="ui-table-grid scd-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Producto</th>
                <th>Presentación</th>
                <th>Stock ERP</th>
                <th>Contado</th>
                <th>Diferencia</th>
                <th>Estado</th>
                <th>Contado por</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              @for (line of filteredLines(); track line.productId; let i = $index) {
                <tr>
                  <td class="scd-muted">{{ i + 1 }}</td>
                  <td class="scd-muted">{{ line.productCode }}</td>
                  <td>{{ line.productName }}</td>
                  <td class="scd-muted">
                    {{ presentationText(line.unitsPerPackage, line.unitOfMeasure) }}
                  </td>
                  <td class="scd-num">
                    @if (line.erpStock == null) {
                      <span class="scd-tag-amber">Sin subida</span>
                    } @else {
                      {{ countNumberText(line.erpStock) }}
                      <div class="scd-muted">{{ shortDateTimeText(line.erpStockAt) }}</div>
                    }
                  </td>
                  <td class="scd-num">
                    @if (line.status === 'PENDING') {
                      —
                    } @else {
                      <strong>{{
                        countedText(line.countedPackages, line.countedUnits, line.countedQuantity)
                      }}</strong>
                    }
                  </td>
                  <td
                    class="scd-num"
                    [class.scd-diff-positive]="(line.difference ?? 0) > 0"
                    [class.scd-diff-negative]="(line.difference ?? 0) < 0"
                  >
                    {{ differenceText(line.difference) }}
                  </td>
                  <td>
                    <span class="scd-badge" [style.color]="lineStatusColor(line.status)">{{
                      lineStatusLabel(line.status)
                    }}</span>
                  </td>
                  <td class="scd-muted">
                    @if (line.countedByName) {
                      {{ line.countedByName }} · {{ shortDateTimeText(line.countedAt) }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="scd-muted">{{ entryMethodLabel(line.entryMethod) }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (filteredLines().length === 0) {
            <ui-empty title="Sin resultados" body="No encontramos productos con ese filtro." />
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .scd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .scd-back {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 700;
        font-size: 13px;
        color: var(--ink-muted);
        padding: 0;
        margin-bottom: 16px;
      }
      .scd-back:hover {
        color: var(--ink);
      }
      .scd-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .scd-title-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-h1, var(--fw-display)) var(--fs-h1, var(--fs-display)) /
          var(--lh-h1, var(--lh-display)) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .scd-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .scd-meta {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .scd-banner {
        margin: 16px 0;
        padding: 10px 14px;
        font-size: 13px;
        color: var(--ink-muted);
        background: var(--faint);
      }
      .scd-blocks {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin: 20px 0;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .scd-block {
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .scd-block-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 700;
      }
      .scd-ro-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .scd-ro-row strong {
        color: var(--ink);
        font-weight: 700;
        text-align: right;
      }
      .scd-danger {
        color: var(--st-mismatch) !important;
      }
      .scd-progress {
        display: grid;
        gap: 4px;
        margin-top: 4px;
      }
      .scd-progress-bar {
        height: 6px;
        background: var(--faint);
      }
      .scd-progress-fill {
        height: 100%;
        background: var(--accent);
      }
      .scd-progress-text {
        font-size: 12px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .scd-toolbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .scd-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .scd-tab {
        appearance: none;
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 8px 14px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .scd-tab-on {
        border-color: var(--accent);
        background: var(--accent-wash);
        color: var(--accent-ink);
      }
      .scd-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .scd-table-wrap {
        overflow-x: auto;
      }
      .scd-table {
        width: 100%;
        min-width: 1200px;
      }
      .scd-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .scd-num {
        text-align: right;
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .scd-diff-positive {
        color: var(--st-mismatch);
      }
      .scd-diff-negative {
        color: var(--st-open);
      }
      .scd-tag-amber {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--st-in-route);
        white-space: nowrap;
      }

      @media (max-width: 1100px) {
        .scd-blocks {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .scd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class StockCountDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(StockCountAdminService);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);

  protected headerStatusLabel = headerStatusLabel;
  protected shortDateTimeText = shortDateTimeText;
  protected relativeTimeText = relativeTimeText;
  protected presentationText = presentationText;
  protected countNumberText = countNumberText;
  protected countedText = countedText;
  protected lineStatusLabel = lineStatusLabel;
  protected lineStatusColor = lineStatusColor;
  protected entryMethodLabel = entryMethodLabel;

  protected q = signal('');
  protected activeTab = signal<TabKey>('PENDING');

  protected detail = signal<StockCountDetailResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected notFound = signal(false);
  protected exporting = signal(false);

  private defaultTabApplied = false;

  protected tabs = computed(() => {
    const d = this.detail();
    const summary = d?.summary ?? { totalProducts: 0, pending: 0, done: 0, notFound: 0 };
    return [
      { key: 'PENDING' as TabKey, label: 'Pendientes', count: summary.pending },
      { key: 'DONE' as TabKey, label: 'Realizados', count: summary.done },
      { key: 'NOT_FOUND' as TabKey, label: 'No encontrados', count: summary.notFound },
      { key: 'ALL' as TabKey, label: 'Todos', count: summary.totalProducts },
    ];
  });

  protected filteredLines = computed<CountProductLine[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const q = this.q().trim().toLowerCase();
    const tab = this.activeTab();
    const statusByTab: Record<Exclude<TabKey, 'ALL'>, CountLineStatus> = {
      PENDING: 'PENDING',
      DONE: 'DONE',
      NOT_FOUND: 'NOT_FOUND',
    };
    return d.products
      .filter((p) => tab === 'ALL' || p.status === statusByTab[tab])
      .filter(
        (p) =>
          !q || p.productCode.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q),
      );
  });

  private manualRefresh$ = new Subject<void>();
  private stockCountId = signal<number | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('stockCountId'));
      this.stockCountId.set(id > 0 ? id : null);
      this.defaultTabApplied = false;
    });

    const heartbeat$ = interval(REFRESH_MS).pipe(
      filter(
        () => document.visibilityState === 'visible' && this.detail()?.header.status === 'OPEN',
      ),
      map(() => undefined),
    );

    merge(this.manualRefresh$, heartbeat$)
      .pipe(
        startWith(undefined),
        switchMap(() => this.load()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected progressPct(d: StockCountDetailResponse): number {
    if (d.header.totalProducts === 0) return 0;
    return Math.round((d.header.countedProducts / d.header.totalProducts) * 100);
  }

  protected headerToneVar(header: StockCountDetailResponse['header'], active: boolean): string {
    return `var(${BADGE_TONE_VAR[headerStatusTone(header, active)]})`;
  }

  protected erpStatusText(header: StockCountDetailResponse['header']): string {
    if (header.erpTaken) return 'Tomado por el ERP';
    return header.status === 'OPEN' ? 'Esperando cierre' : 'Esperando al ERP';
  }

  protected differenceText(value: number | null): string {
    if (value == null) return '—';
    const text = countNumberText(Math.abs(value));
    if (value > 0) return `+${text}`;
    if (value < 0) return `−${text}`;
    return text;
  }

  protected refresh() {
    this.manualRefresh$.next();
  }

  protected goBack() {
    this.router.navigate(['/inventario/conteo']);
  }

  protected exportTable(format: ExportFormat) {
    const d = this.detail();
    if (!d || this.filteredLines().length === 0) return;
    this.exporting.set(true);
    this.exporter
      .export(stockCountExportTable(d.header, d.summary, this.filteredLines()), format)
      .catch((err) => {
        this.toast.error(err instanceof Error ? err.message : 'No se pudo generar el archivo.');
      })
      .finally(() => this.exporting.set(false));
  }

  private load() {
    const stockCountId = this.stockCountId();
    if (!stockCountId) return of(null);
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    return this.svc.detail(stockCountId).pipe(
      map((d) => {
        this.detail.set(d);
        this.loading.set(false);
        if (!this.defaultTabApplied) {
          this.defaultTabApplied = true;
          if (d.summary.notFound > 0) this.activeTab.set('NOT_FOUND');
          else if (d.header.status === 'CLOSED') this.activeTab.set('ALL');
          else this.activeTab.set('PENDING');
        }
      }),
      catchError((err) => {
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
        return of(null);
      }),
    );
  }
}
