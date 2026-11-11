import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { ToastService } from '../../core/ui/toast';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ExportFormat } from '../../shared/utils/export/export.models';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { SalesReportAdminService } from './sales-report-admin';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { CounterSessionStore } from '../orders/counter-session-store';
import { WarehouseView } from '../../shared/models/inventory.models';
import {
  NegativeStockReport,
  StockValidationReport,
  StockValidationRow,
} from '../../shared/models/sales-report.models';
import { dateText, dateTimeText } from '../assignments/assignment-format';
import { quantityText } from './sales-report-format';
import { StockValidationOrdersDialog } from './ui/stock-validation-orders-dialog';
import {
  BADGE_TONE_VAR,
  BadgeTone,
  TIP,
  erpUploadScreenText,
  statusLabel,
  statusTone,
} from './stock-validation-format';
import { negativeStockExportTable } from './domain/negative-stock.columns';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SubTab = 'facturar' | 'negativos';

type CardKey = 'shortfallCount' | 'advanceNotBackedCount' | 'staleCount' | 'appExcessCount';

interface CardDef {
  key: CardKey;
  label: string;
  tip: string;
  predicate: (r: StockValidationRow) => boolean;
}

const CARDS: CardDef[] = [
  {
    key: 'shortfallCount',
    label: 'Faltan stock',
    tip: TIP.shortfallCard,
    predicate: (r) => r.status === 'SHORTFALL',
  },
  {
    key: 'advanceNotBackedCount',
    label: 'Adelanto sin respaldo',
    tip: TIP.advanceNotBackedCard,
    predicate: (r) => r.advanceNotBacked,
  },
  {
    key: 'staleCount',
    label: 'Sin actualizar',
    tip: TIP.staleCard,
    predicate: (r) => r.erpStale,
  },
  {
    key: 'appExcessCount',
    label: 'App con de más',
    tip: TIP.appExcessCard,
    predicate: (r) => (r.nextAdjustment ?? 0) < 0,
  },
];

/**
 * Validación de stock — doc 56, sección 6. Reemplaza "Ventas con stock"
 * (doc 30): cruza lo que falta facturar contra el stock del ERP para que
 * supervisión corrija los pedidos antes de enviar a facturación. Todo lo
 * calcula el servidor; el panel solo muestra y filtra en el navegador.
 */
@Component({
  selector: 'app-stock-validation-tab',
  imports: [UiButton, UiField, UiToggle, UiEmpty, UiInfoTip, UiExportMenu, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="svt-page">
      <nav class="svt-subtabs">
        <button
          type="button"
          class="svt-subtab"
          [class.active]="subTab() === 'facturar'"
          (click)="setSubTab('facturar')"
        >
          Por facturar
        </button>
        <button
          type="button"
          class="svt-subtab"
          [class.active]="subTab() === 'negativos'"
          (click)="setSubTab('negativos')"
        >
          Negativos del día
          @if (negReport(); as nr) {
            @if (nr.negativeCount > 0) {
              <span class="svt-subtab-badge">{{ nr.negativeCount }}</span>
            }
          }
        </button>
      </nav>

      <div class="svt-head">
        <div>
          <h1>Validación de stock</h1>
          <p class="svt-sub">{{ subTab() === 'facturar' ? subtitleText() : negSubtitleText() }}</p>
        </div>
        @if (subTab() === 'facturar') {
          <button uiButton variant="ghost" (click)="load()" [loading]="loading()">
            ↻ Actualizar
          </button>
        } @else {
          <div class="svt-head-actions">
            <button uiButton variant="ghost" (click)="loadNegatives()" [loading]="negLoading()">
              ↻ Actualizar
            </button>
            <ui-export-menu
              [formats]="['xlsx', 'pdf']"
              [disabled]="negLoading() || negError() || (negReport()?.negativeCount ?? 0) === 0"
              [busy]="exportingNeg()"
              (export)="exportNegatives($event)"
            />
          </div>
        }
      </div>

      @if (subTab() === 'facturar') {
        @if (report(); as r) {
          @if (r.pendingUploads > 0) {
            <div class="svt-banner svt-banner-amber">
              El ERP todavía está procesando {{ r.pendingUploads }} producto{{
                r.pendingUploads === 1 ? '' : 's'
              }}. Espere un momento y pulse Actualizar.
            </div>
          } @else if (!r.lastErpUploadAt) {
            <div class="svt-banner svt-banner-gray">
              El ERP todavía no ha subido stock de este almacén.
            </div>
          }
        }

        <div class="svt-toolbar">
          <ui-field
            label="Almacén"
            type="select"
            [(value)]="warehouseId"
            [options]="warehouseOptions()"
            [disabled]="loadingWarehouses()"
          />
          <ui-toggle label="Solo con problema" [(checked)]="onlyIssues" class="svt-toggle" />
        </div>

        @if (!warehouseId()) {
          <ui-empty title="Elige un almacén" body="Selecciona el almacén para validar su stock." />
        } @else if (loading()) {
          <div class="svt-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar la información."
            body="Inténtalo de nuevo."
            actionLabel="Reintentar"
            (action)="load()"
          />
        } @else if (report(); as r) {
          <div class="svt-cards">
            <button
              type="button"
              class="svt-card"
              [class.svt-card-on]="activeCard() === null"
              (click)="activeCard.set(null)"
            >
              <span class="svt-card-value">{{ r.productCount }}</span>
              <span class="svt-card-label">Por facturar</span>
            </button>
            @for (c of cards; track c.key) {
              <button
                type="button"
                class="svt-card"
                [class.svt-card-on]="activeCard() === c.key"
                [class.svt-card-warn]="r[c.key] > 0"
                (click)="toggleCard(c.key)"
              >
                <div class="svt-card-top">
                  <span class="svt-card-value">{{ r[c.key] }}</span>
                  <span [uiInfoTip]="c.tip"></span>
                </div>
                <span class="svt-card-label">{{ c.label }}</span>
              </button>
            }
          </div>

          @if (visibleRows().length === 0) {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              [title]="
                onlyIssues()
                  ? 'Todo lo que falta facturar tiene stock en el ERP.'
                  : 'No hay pedidos por facturar en este almacén.'
              "
            />
          } @else {
            <div class="svt-table-wrap">
              <table class="ui-table-grid svt-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>UM</th>
                    <th>Por facturar <span [uiInfoTip]="TIP.toBillQuantity"></span></th>
                    <th>Bonif. pend. <span [uiInfoTip]="TIP.pendingQuantity"></span></th>
                    <th>Stock ERP <span [uiInfoTip]="TIP.erpStock"></span></th>
                    <th>Disponible <span [uiInfoTip]="TIP.availableQuantity"></span></th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleRows(); track row.productId) {
                    <tr class="svt-row" (click)="openProduct(row.productId)">
                      <td class="svt-muted">{{ row.productCode }}</td>
                      <td>{{ row.productName }}</td>
                      <td class="svt-muted">{{ row.unitOfMeasure }}</td>
                      <td class="svt-num">{{ quantityText(row.toBillQuantity) }}</td>
                      <td class="svt-num svt-muted">
                        {{ row.pendingQuantity > 0 ? quantityText(row.pendingQuantity) : '—' }}
                      </td>
                      <td class="svt-num" [class.svt-dim]="row.erpStale">
                        {{ row.erpStock != null ? quantityText(row.erpStock) : '—' }}
                        <span
                          [uiInfoTip]="
                            row.erpStockAt
                              ? 'Actualizado ' + dateTimeText(row.erpStockAt)
                              : 'Nunca actualizado'
                          "
                        ></span>
                      </td>
                      <td class="svt-num" [class.svt-negative]="(row.availableQuantity ?? 0) < 0">
                        {{
                          row.availableQuantity != null ? quantityText(row.availableQuantity) : '—'
                        }}
                      </td>
                      <td>
                        <div class="svt-status-cell">
                          <span class="svt-badge" [style.color]="'var(' + toneVar(row) + ')'">{{
                            statusLabel(row)
                          }}</span>
                          @if (row.erpStale) {
                            <span class="svt-tag svt-tag-amber">Sin actualizar</span>
                          }
                          @if (row.advanceNotBacked) {
                            <span class="svt-tag svt-tag-amber"
                              >Adelanto sin respaldo en el ERP</span
                            >
                          }
                          @if ((row.nextAdjustment ?? 0) < 0) {
                            <span class="svt-tag svt-tag-amber"
                              >La app tiene {{ quantityText(-(row.nextAdjustment ?? 0)) }} de
                              más</span
                            >
                          }
                        </div>
                      </td>
                      <td class="svt-chevron">›</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }

      @if (subTab() === 'negativos') {
        @if (negReport(); as nr) {
          @if (nr.pendingUploads > 0) {
            <div class="svt-banner svt-banner-amber">
              El ERP está terminando de subir el stock. Espere y vuelva a validar.
            </div>
          } @else if (!nr.lastErpUploadAt) {
            <div class="svt-banner svt-banner-gray">
              El ERP no ha subido stock a este almacén: no se pueden validar negativos.
            </div>
          }
        }

        <div class="svt-toolbar">
          <ui-field
            label="Almacén"
            type="select"
            [(value)]="warehouseId"
            [options]="warehouseOptions()"
            [disabled]="loadingWarehouses()"
          />
          <ui-field label="Día de los pedidos" type="date" [(value)]="negDate" />
        </div>

        @if (!warehouseId()) {
          <ui-empty title="Elige un almacén" body="Selecciona el almacén para ver sus negativos." />
        } @else if (negLoading()) {
          <div class="svt-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (negError()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el reporte de negativos."
            [body]="negErrorDetail() || 'Inténtalo de nuevo.'"
            actionLabel="Reintentar"
            (action)="loadNegatives()"
          />
        } @else if (negReport(); as nr) {
          <div class="svt-cards svt-cards-3">
            <div class="svt-card svt-card-static">
              <span class="svt-card-value">{{ nr.productCount }}</span>
              <span class="svt-card-label">Productos vendidos</span>
              <span class="svt-card-caption">Pedidos del {{ dateText(nr.date) }}</span>
            </div>
            <div class="svt-card svt-card-static" [class.svt-card-danger]="nr.negativeCount > 0">
              <span class="svt-card-value">{{ nr.negativeCount }}</span>
              <span class="svt-card-label">Negativos</span>
              <span class="svt-card-caption">Lo vendido supera al stock del ERP</span>
            </div>
            <div class="svt-card svt-card-static" [class.svt-card-amber]="nr.noErpStockCount > 0">
              <span class="svt-card-value">{{ nr.noErpStockCount }}</span>
              <span class="svt-card-label">Sin subida del ERP</span>
              <span class="svt-card-caption">Productos que el ERP nunca subió</span>
            </div>
          </div>

          @if (nr.negativeCount === 0) {
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              [title]="'Todo lo vendido el ' + dateText(nr.date) + ' alcanza con el stock del ERP.'"
            />
          } @else {
            <div class="svt-table-wrap">
              <table class="ui-table-grid svt-table">
                <thead>
                  <tr>
                    <th>Ítem</th>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Und.</th>
                    <th>Vendido</th>
                    <th>Stock app</th>
                    <th>Stock ERP</th>
                    <th>Subida ERP</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of nr.rows; track row.productId; let i = $index) {
                    <tr class="svt-row" (click)="openProduct(row.productId)">
                      <td class="svt-muted">{{ i + 1 }}</td>
                      <td class="svt-muted">{{ row.productCode }}</td>
                      <td>{{ row.productName }}</td>
                      <td class="svt-muted">{{ row.unitOfMeasure }}</td>
                      <td class="svt-num">{{ quantityText(row.soldQuantity) }}</td>
                      <td class="svt-num svt-muted">{{ quantityText(row.systemStock) }}</td>
                      <td class="svt-num">
                        {{ row.erpStock != null ? quantityText(row.erpStock) : '—' }}
                      </td>
                      <td class="svt-neg-upload">
                        @if (row.erpStockAt) {
                          {{ erpUploadScreenText(row.erpStockAt) }}
                          @if (row.erpStale) {
                            <span
                              class="material-icons svt-neg-stale-icon"
                              aria-hidden="true"
                              [uiInfoTip]="'No vino en la última actualización del ERP'"
                              >warning</span
                            >
                          }
                        } @else {
                          <span class="svt-badge-amber">Sin subida</span>
                        }
                      </td>
                      <td class="svt-num svt-negative">
                        {{ quantityText(row.difference) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .svt-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .svt-subtabs {
        display: flex;
        gap: var(--sp-5);
        border-bottom: var(--border-rule);
        margin-bottom: 4px;
      }
      .svt-subtab {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: var(--sp-3) 0;
        background: none;
        border: 0;
        border-bottom: 3px solid transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .svt-subtab:hover {
        color: var(--ink);
      }
      .svt-subtab.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .svt-subtab-badge {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-pill);
        background: var(--st-mismatch);
        color: var(--bg);
        font-size: 11px;
        font-weight: 800;
      }
      .svt-head-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .svt-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .svt-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .svt-banner {
        margin-top: 16px;
        padding: 10px 14px;
        font-size: 13px;
        border-left: 3px solid var(--st-pendiente);
      }
      .svt-banner-amber {
        border-color: var(--st-pendiente);
        background: color-mix(in srgb, var(--st-pendiente) 10%, transparent);
      }
      .svt-banner-gray {
        border-color: var(--hairline);
        background: var(--faint);
        color: var(--ink-muted);
      }
      .svt-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
        margin: 20px 0;
      }
      .svt-toolbar ui-field {
        width: 220px;
      }
      .svt-toggle {
        min-width: 220px;
      }
      .svt-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .svt-cards {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .svt-cards-3 {
        grid-template-columns: repeat(3, 1fr);
        max-width: 640px;
      }
      .svt-card {
        appearance: none;
        text-align: left;
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
        cursor: pointer;
        font-family: var(--font-sans);
      }
      .svt-card:hover {
        border-color: var(--accent);
      }
      .svt-card-on {
        border-color: var(--ink);
        border-width: 2px;
      }
      .svt-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .svt-card-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
        color: var(--ink);
      }
      .svt-card-warn .svt-card-value {
        color: var(--st-pendiente);
      }
      .svt-card-static {
        cursor: default;
      }
      .svt-card-static:hover {
        border-color: var(--hairline);
      }
      .svt-card-amber .svt-card-value {
        color: var(--st-in-route);
      }
      .svt-card-danger {
        border-color: var(--st-mismatch);
      }
      .svt-card-danger .svt-card-value {
        color: var(--st-mismatch);
      }
      .svt-card-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .svt-card-caption {
        font-size: 11px;
        color: var(--ink-muted);
        opacity: 0.8;
      }
      .svt-table-wrap {
        overflow-x: auto;
      }
      .svt-table {
        width: 100%;
      }
      .svt-row {
        cursor: pointer;
      }
      .svt-row:hover {
        background: var(--faint);
      }
      .svt-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .svt-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .svt-dim {
        opacity: 0.5;
      }
      .svt-negative {
        color: var(--st-mismatch);
        font-weight: 800;
      }
      .svt-status-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
      }
      .svt-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .svt-tag {
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .svt-tag-amber {
        color: var(--st-in-route);
      }
      .svt-neg-upload {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .svt-neg-stale-icon {
        font-size: 15px;
        color: var(--st-in-route);
      }
      .svt-badge-amber {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--st-in-route);
        white-space: nowrap;
      }
      .svt-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }

      @media (max-width: 1100px) {
        .svt-cards {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 767px) {
        .svt-page {
          padding: var(--sp-4);
        }
        .svt-cards {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class StockValidationTab {
  private reportSvc = inject(SalesReportAdminService);
  private catalogSvc = inject(CatalogLookupService);
  private dialog = inject(UiDialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);
  protected counterSession = inject(CounterSessionStore);

  protected quantityText = quantityText;
  protected dateTimeText = dateTimeText;
  protected dateText = dateText;
  protected statusLabel = statusLabel;
  protected erpUploadScreenText = erpUploadScreenText;
  protected TIP = TIP;
  protected cards = CARDS;
  protected toneVar = (row: StockValidationRow) => BADGE_TONE_VAR[statusTone(row)];

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);
  protected warehouseId = signal('');
  protected onlyIssues = signal(true);
  protected activeCard = signal<CardKey | null>(null);

  protected report = signal<StockValidationReport | null>(null);
  protected loading = signal(false);
  protected error = signal(false);

  // — Negativos del día — doc 63, sección 6 —
  protected subTab = signal<SubTab>(
    this.route.snapshot.queryParamMap.get('tab') === 'negativos' ? 'negativos' : 'facturar',
  );
  protected negDate = signal(this.route.snapshot.queryParamMap.get('date') || todayIso());
  protected negReport = signal<NegativeStockReport | null>(null);
  protected negLoading = signal(false);
  protected negError = signal(false);
  protected negErrorDetail = signal('');
  protected exportingNeg = signal(false);

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingWarehouses() ? 'Cargando…' : 'Selecciona un almacén' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  protected subtitleText = computed(() => {
    const r = this.report();
    if (!r) return '';
    return `${r.warehouseName} · Última actualización del ERP: ${r.lastErpUploadAt ? dateTimeText(r.lastErpUploadAt) : '—'}`;
  });

  protected negSubtitleText = computed(() => {
    const r = this.negReport();
    if (!r) return '';
    return `${r.warehouseName} · Stock ERP al ${r.lastErpUploadAt ? dateTimeText(r.lastErpUploadAt) : '—'}`;
  });

  protected visibleRows = computed(() => {
    const r = this.report();
    if (!r) return [];
    const card = this.activeCard();
    if (!card) return r.rows;
    const def = this.cards.find((c) => c.key === card)!;
    return r.rows.filter(def.predicate);
  });

  private loadEffect = effect(() => {
    this.warehouseId();
    this.onlyIssues();
    untracked(() => {
      if (this.warehouseId()) this.load();
    });
  });

  private loadNegEffect = effect(() => {
    this.warehouseId();
    this.negDate();
    const tab = this.subTab();
    untracked(() => {
      if (tab === 'negativos' && this.warehouseId()) this.loadNegatives();
    });
  });

  constructor() {
    this.counterSession.ensureLoaded();
    const qpWarehouseId = this.route.snapshot.queryParamMap.get('warehouseId');
    this.catalogSvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        if (qpWarehouseId && list.some((w) => String(w.warehouseId) === qpWarehouseId)) {
          this.warehouseId.set(qpWarehouseId);
          return;
        }
        const ownId = this.counterSession.warehouseId();
        if (ownId && list.some((w) => w.warehouseId === ownId)) {
          this.warehouseId.set(String(ownId));
        }
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected toggleCard(key: CardKey) {
    this.activeCard.set(this.activeCard() === key ? null : key);
  }

  protected setSubTab(tab: SubTab) {
    this.subTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'negativos' ? 'negativos' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  loadNegatives() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.negLoading.set(true);
    this.negError.set(false);
    this.negErrorDetail.set('');
    this.reportSvc.negatives(warehouseId, this.negDate() || undefined).subscribe({
      next: (result) => {
        this.negReport.set(result);
        this.negLoading.set(false);
      },
      error: (err) => {
        this.negLoading.set(false);
        this.negError.set(true);
        this.negErrorDetail.set(err?.error?.detail || '');
      },
    });
  }

  protected exportNegatives(format: ExportFormat) {
    const r = this.negReport();
    if (!r || r.negativeCount === 0) return;
    this.exportingNeg.set(true);
    this.exporter
      .export(negativeStockExportTable(r), format)
      .catch((err) => {
        this.toast.error(err instanceof Error ? err.message : 'No se pudo generar el archivo.');
      })
      .finally(() => this.exportingNeg.set(false));
  }

  load() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    this.activeCard.set(null);
    this.reportSvc.stockValidation(warehouseId, this.onlyIssues()).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
        this.maybeOpenFromQueryParam();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Llega desde "Ver en Validación de stock" (doc 56, sección 8) con ?productId=. */
  private maybeOpenFromQueryParam() {
    const qp = this.route.snapshot.queryParamMap.get('productId');
    if (!qp) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.openProduct(Number(qp));
  }

  protected openProduct(productId: number) {
    const warehouseId = Number(this.warehouseId());
    const ref = this.dialog.open<
      StockValidationOrdersDialog,
      { productId: number; warehouseId: number }
    >(StockValidationOrdersDialog, { data: { productId, warehouseId }, width: '760px' });
    ref.afterClosed().subscribe((changed) => {
      if (!changed) return;
      if (this.subTab() === 'negativos') this.loadNegatives();
      else this.load();
    });
  }
}
