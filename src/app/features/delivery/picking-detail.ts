import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { ToastService } from '../../core/ui/toast';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { PickingAdminService } from './picking-admin';
import {
  DeclarePickingItemsCommand,
  PickingDetail,
  PickingItemCommand,
  PickingProductConsolidatedView,
} from '../../shared/models/picking.models';
import { BATCH_STATUS_COLOR_VAR, batchStatusName } from './delivery-format';
import {
  PICKING_STATUS_COLOR_VAR,
  PICKING_STATUS_OPTIONS,
  packSuffixText,
  pickingStatusName,
  previewStatus,
  reviewedText,
  shortDateTimeText,
} from './picking-format';
import { quantityText } from '../sales-reports/sales-report-format';
import { PickingCloseDialog } from './ui/picking-close-dialog';

interface Draft {
  loadedQuantity: number | null;
  shortNote: string;
}

interface ProductRowVm {
  p: PickingProductConsolidatedView;
  effectiveLoaded: number | null;
  effectiveNote: string;
  previewStatusCode: string;
  dirty: boolean;
  error: string;
}

/**
 * Detalle de picking (doc 89, sección 5): consolidado por producto (donde
 * se declara) y desglose por comprobante (solo consulta). Guardar avance
 * manda únicamente las filas tocadas; el backend es la única fuente de
 * verdad del estado — el front solo adelanta una vista previa del chip
 * mientras el usuario escribe (sección 3.3, "regla de oro").
 */
@Component({
  selector: 'app-picking-detail',
  imports: [RouterLink, UiButton, UiField, UiEmpty],
  template: `
    <section class="pkd-page">
      @if (loading()) {
        <div class="pkd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (forbidden()) {
        <ui-empty title="No tienes permiso para ver esta pantalla." />
      } @else if (notFound()) {
        <ui-empty
          title="Planilla no encontrada"
          actionLabel="Volver al listado"
          (action)="goToList()"
        />
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el picking."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (detail(); as d) {
        <nav class="pkd-breadcrumb">
          <a routerLink="/reparto/picking">Picking</a>
          <span> › Planilla {{ d.series }}-{{ d.number }}</span>
        </nav>

        <div class="pkd-head">
          <div class="pkd-head-main">
            <h1>Planilla {{ d.series }}-{{ d.number }}</h1>
            <p class="pkd-sub">
              {{ d.batchDate ? batchDateText(d.batchDate) : '' }} ·
              {{ d.vehiclePlate ? d.vehiclePlate + ' · ' + d.driverName : 'Sin equipo' }} ·
              {{ batchStatusName(d.statusCode) }}
            </p>
          </div>
          @if (canClose()) {
            <button
              uiButton
              variant="primary"
              [disabled]="!canCloseNow()"
              [title]="closeDisabledReason()"
              (click)="closePicking()"
            >
              Cerrar picking
            </button>
          }
        </div>

        @if (d.pickingConfirmedAt) {
          <div class="pkd-banner pkd-banner-closed">
            🔒 Picking cerrado el {{ shortDateTimeText(d.pickingConfirmedAt) }}
            @if (d.pickingConfirmedByName) {
              por {{ d.pickingConfirmedByName }}
            }
            . Solo lectura.
          </div>
          @if (legacyClosed()) {
            <div class="pkd-banner pkd-banner-info">
              Picking cerrado con el sistema anterior: no tiene la carga declarada por producto.
            </div>
          }
        } @else {
          <div class="pkd-banner pkd-banner-open">
            Picking en curso — {{ reviewedText(d.pickingCounts) }}
          </div>
          @if (!canEdit()) {
            <div class="pkd-banner pkd-banner-info">
              Almacén está revisando la carga. Vista de solo lectura.
            </div>
          }
        }

        <div class="pkd-chips">
          @for (opt of statusOptions; track opt.code) {
            <button
              type="button"
              class="pkd-chip"
              [class.pkd-chip-on]="statusFilter() === opt.code"
              [style.borderColor]="'var(' + statusColorVar[opt.code] + ')'"
              (click)="toggleStatusFilter(opt.code)"
            >
              <span [style.color]="'var(' + statusColorVar[opt.code] + ')'">{{
                countFor(opt.code)
              }}</span>
              {{ chipLabel(opt.code) }}
            </button>
          }
        </div>

        <nav class="pkd-tabs">
          <button
            type="button"
            class="pkd-tab"
            [class.active]="tab() === 'carga'"
            (click)="tab.set('carga')"
          >
            Carga por producto
          </button>
          <button
            type="button"
            class="pkd-tab"
            [class.active]="tab() === 'comprobante'"
            (click)="tab.set('comprobante')"
          >
            Por comprobante
          </button>
        </nav>

        @if (tab() === 'carga') {
          <div class="pkd-toolbar">
            <ui-field label="Buscar" placeholder="Código o nombre" [(value)]="search" />
            @if (canEdit() && pendingVisibleCount() > 0) {
              <button uiButton variant="secondary" size="sm" (click)="bulkCompletePending()">
                Marcar pendientes como completos
              </button>
            }
            <button uiButton variant="ghost" size="sm" (click)="printSheet()">
              Imprimir hoja de carga
            </button>
          </div>

          @if (visibleRows().length === 0) {
            <ui-empty title="Sin productos" body="No hay productos que coincidan con el filtro." />
          } @else {
            <div class="pkd-table-wrap">
              <table class="ui-table-grid pkd-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Esperado</th>
                    <th>Cargado</th>
                    <th>Faltante</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                    <th>Declarado por</th>
                    @if (canEdit()) {
                      <th></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleRows(); track row.p.productId) {
                    <tr [attr.data-product-row]="row.p.productId" [class.pkd-row-dirty]="row.dirty">
                      <td class="pkd-muted">{{ row.p.productCode }}</td>
                      <td>
                        {{ row.p.productName }}
                        <div class="pkd-product-sub">
                          {{ row.p.unitOfMeasure }}
                          @if (packSuffixText(row.p)) {
                            {{ packSuffixText(row.p) }}
                          }
                        </div>
                      </td>
                      <td class="pkd-num">
                        {{ quantityText(row.p.totalQuantity) }}
                        @if (row.p.fullPackages != null) {
                          <div class="pkd-expected-sub">
                            {{ quantityText(row.p.fullPackages) }} paq +
                            {{ quantityText(row.p.looseUnits) }} und
                          </div>
                        }
                        @if (row.p.bonusQuantity > 0) {
                          <span class="pkd-bonus-chip"
                            >incl. {{ quantityText(row.p.bonusQuantity) }} bonif.</span
                          >
                        }
                      </td>
                      <td class="pkd-num">
                        @if (canEdit()) {
                          <input
                            type="number"
                            class="pkd-qty-input"
                            [id]="'pk-qty-' + row.p.productId"
                            min="0"
                            [max]="row.p.totalQuantity"
                            [value]="row.effectiveLoaded ?? ''"
                            (input)="onQtyInput(row.p, $event)"
                            (keydown.enter)="onQtyEnter($event, row.p.productId)"
                          />
                        } @else {
                          {{
                            row.effectiveLoaded != null ? quantityText(row.effectiveLoaded) : '—'
                          }}
                        }
                      </td>
                      <td class="pkd-num" [class.pkd-negative]="row.p.shortQuantity > 0">
                        {{ row.p.shortQuantity > 0 ? quantityText(row.p.shortQuantity) : '—' }}
                      </td>
                      <td>
                        <span
                          class="pkd-status-chip"
                          [style.color]="'var(' + statusColorVar[row.previewStatusCode] + ')'"
                        >
                          {{ pickingStatusName(row.previewStatusCode) }}
                        </span>
                        @if (row.dirty) {
                          <span class="pkd-unsaved">sin guardar</span>
                        }
                      </td>
                      <td class="pkd-note-cell">
                        @if (canEdit()) {
                          <input
                            type="text"
                            class="pkd-note-input"
                            maxlength="200"
                            [disabled]="
                              row.previewStatusCode === 'COMPLETE' ||
                              row.previewStatusCode === 'PENDING'
                            "
                            [value]="row.effectiveNote"
                            (input)="onNoteInput(row.p, $event)"
                          />
                        } @else {
                          {{ row.effectiveNote || '—' }}
                        }
                        @if (row.error) {
                          <div class="pkd-row-error">{{ row.error }}</div>
                        }
                      </td>
                      <td class="pkd-muted">
                        @if (row.p.confirmedByName) {
                          {{ row.p.confirmedByName }}
                          <div class="pkd-confirmed-at">
                            {{ shortDateTimeText(row.p.confirmedAt) }}
                          </div>
                        } @else {
                          —
                        }
                      </td>
                      @if (canEdit()) {
                        <td>
                          <button uiButton variant="ghost" size="sm" (click)="markComplete(row.p)">
                            ✔ Completo
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        } @else {
          <div class="pkd-toolbar">
            <ui-field
              label="Buscar"
              placeholder="Cliente o comprobante"
              [(value)]="voucherSearch"
            />
          </div>
          @if ((d.invoices ?? []).length === 0) {
            <ui-empty
              title="Sin comprobantes"
              body="No hay desglose por comprobante para esta planilla."
            />
          } @else if (visibleVouchers().length === 0) {
            <ui-empty
              title="Sin resultados"
              body="No hay comprobantes que coincidan con el filtro."
            />
          } @else {
            <div class="pkd-vouchers">
              @for (v of visibleVouchers(); track v.invoiceId) {
                <details class="pkd-voucher">
                  <summary>
                    <strong>{{ v.invoiceId }}</strong> — {{ v.customerName ?? '—' }} ·
                    {{ (v.lines ?? []).length }} producto{{
                      (v.lines ?? []).length === 1 ? '' : 's'
                    }}
                  </summary>
                  <table class="ui-table-grid pkd-voucher-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Familia</th>
                        <th>Cantidad</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of v.lines ?? []; track line.productId) {
                        <tr>
                          <td class="pkd-muted">{{ line.productCode ?? '—' }}</td>
                          <td>{{ line.productName ?? '—' }}</td>
                          <td class="pkd-muted">{{ line.familyName ?? '—' }}</td>
                          <td class="pkd-num">{{ quantityText(line.quantity) }}</td>
                          <td>
                            @if (line.bonus) {
                              <span class="pkd-bonus-chip">Bonif.</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </details>
              }
            </div>
          }
        }
      }
    </section>

    @if (tab() === 'carga' && dirtyCount() > 0) {
      <div class="pkd-sticky-bar">
        <span
          >{{ dirtyCount() }} producto{{ dirtyCount() === 1 ? '' : 's' }} modificado{{
            dirtyCount() === 1 ? '' : 's'
          }}</span
        >
        @if (firstErrorProductId() != null) {
          <button type="button" class="pkd-error-link" (click)="goToFirstError()">Ver error</button>
        }
        <div class="pkd-sticky-actions">
          <button uiButton variant="secondary" size="sm" (click)="discardChanges()">
            Descartar
          </button>
          <button
            uiButton
            variant="primary"
            size="sm"
            [disabled]="hasErrors() || saving()"
            [loading]="saving()"
            (click)="saveProgress()"
          >
            Guardar avance
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .pkd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
        padding-bottom: 80px;
      }
      .pkd-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .pkd-breadcrumb {
        font-size: 13px;
        color: var(--ink-muted);
        margin-bottom: 10px;
      }
      .pkd-breadcrumb a {
        color: var(--ink-muted);
        text-decoration: none;
      }
      .pkd-breadcrumb a:hover {
        text-decoration: underline;
      }
      .pkd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pkd-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pkd-banner {
        margin-top: 16px;
        padding: 10px 14px;
        font-size: 13px;
        border-left: 3px solid var(--hairline);
      }
      .pkd-banner-open {
        border-color: var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
      }
      .pkd-banner-closed {
        border-color: var(--success);
        background: color-mix(in srgb, var(--success) 10%, transparent);
        font-weight: 700;
      }
      .pkd-banner-info {
        border-color: var(--hairline);
        background: var(--faint);
        color: var(--ink-muted);
      }
      .pkd-chips {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin: 16px 0;
      }
      .pkd-chip {
        appearance: none;
        background: var(--bg);
        border: 1px solid var(--hairline);
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        gap: 6px;
        align-items: center;
        color: var(--ink);
      }
      .pkd-chip-on {
        border-width: 2px;
      }
      .pkd-tabs {
        display: flex;
        gap: 0;
        border-bottom: var(--border-rule);
        margin-bottom: 16px;
      }
      .pkd-tab {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 12px 16px;
        background: none;
        border: 0;
        border-bottom: 3px solid transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .pkd-tab.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .pkd-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .pkd-toolbar ui-field {
        width: 240px;
      }
      .pkd-table-wrap {
        overflow-x: auto;
        position: relative;
      }
      .pkd-table {
        width: 100%;
      }
      .pkd-table thead th {
        position: sticky;
        top: 0;
        background: var(--bg);
        z-index: 1;
      }
      .pkd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pkd-product-sub {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .pkd-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .pkd-expected-sub {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .pkd-bonus-chip {
        display: inline-block;
        margin-top: 2px;
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-muted);
        border: 1px solid var(--hairline);
        padding: 1px 6px;
      }
      .pkd-negative {
        color: var(--status-danger);
        font-weight: 800;
      }
      .pkd-qty-input,
      .pkd-note-input {
        font-family: var(--font-sans);
        font-size: 14px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        min-height: var(--touch-min);
        padding: 0 10px;
        box-sizing: border-box;
      }
      .pkd-qty-input {
        width: 90px;
        text-align: right;
      }
      .pkd-note-input {
        width: 220px;
      }
      .pkd-note-input:disabled {
        opacity: 0.4;
      }
      .pkd-status-chip {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .pkd-unsaved {
        display: block;
        font-size: 10px;
        color: var(--status-warn);
        font-weight: 700;
      }
      .pkd-row-dirty {
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .pkd-row-error {
        margin-top: 4px;
        font-size: 11px;
        color: var(--status-danger);
      }
      .pkd-confirmed-at {
        font-size: 11px;
      }
      .pkd-vouchers {
        display: grid;
        gap: 8px;
      }
      .pkd-voucher {
        border: 1px solid var(--hairline);
        padding: 10px 14px;
      }
      .pkd-voucher summary {
        cursor: pointer;
        font-size: 13px;
        color: var(--ink);
      }
      .pkd-voucher-table {
        width: 100%;
        margin-top: 10px;
      }
      .pkd-sticky-bar {
        position: sticky;
        bottom: 0;
        left: 0;
        width: 100%;
        background: var(--bg);
        border-top: var(--border-rule);
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
        padding: 12px var(--sp-8);
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: 13px;
        color: var(--ink);
        z-index: 10;
      }
      .pkd-sticky-actions {
        margin-left: auto;
        display: flex;
        gap: 10px;
      }
      .pkd-error-link {
        appearance: none;
        border: 0;
        background: none;
        color: var(--status-danger);
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
      }

      @media print {
        .pkd-head button,
        .pkd-banner,
        .pkd-chips,
        .pkd-tabs,
        .pkd-toolbar button,
        .pkd-sticky-bar,
        .pkd-breadcrumb {
          display: none !important;
        }
      }

      @media (max-width: 767px) {
        .pkd-page {
          padding: var(--sp-4);
          padding-bottom: 80px;
        }
        .pkd-sticky-bar {
          padding: 12px var(--sp-4);
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class PickingDetailPage {
  private pickingSvc = inject(PickingAdminService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);

  batchId = input('');

  protected batchStatusName = batchStatusName;
  protected pickingStatusName = pickingStatusName;
  protected quantityText = quantityText;
  protected shortDateTimeText = shortDateTimeText;
  protected reviewedText = reviewedText;
  protected packSuffixText = packSuffixText;
  protected statusOptions = PICKING_STATUS_OPTIONS;
  protected statusColorVar = PICKING_STATUS_COLOR_VAR;
  protected batchStatusColorVar = BATCH_STATUS_COLOR_VAR;

  protected canStore = computed(() => this.auth.hasAny('picking.store'));

  protected detail = signal<PickingDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected forbidden = signal(false);
  protected notFound = signal(false);

  protected tab = signal<'carga' | 'comprobante'>('carga');
  protected statusFilter = signal<string | null>(null);
  protected search = signal('');
  protected voucherSearch = signal('');
  protected saving = signal(false);
  protected closing = signal(false);

  protected drafts = signal<Record<number, Draft>>({});

  /** Solo con `picking.store` y la planilla sin cerrar — doc 89, sección 1.3. */
  protected canEdit = computed(() => this.canStore() && !this.detail()?.pickingConfirmedAt);
  protected canClose = computed(() => this.canStore() && !this.detail()?.pickingConfirmedAt);

  protected rows = computed<ProductRowVm[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const drafts = this.drafts();
    return (d.consolidatedByProduct ?? []).map((p) => {
      const draft = drafts[p.productId];
      const effectiveLoaded = draft ? draft.loadedQuantity : p.loadedQuantity;
      const effectiveNote = draft ? draft.shortNote : (p.shortNote ?? '');
      const previewStatusCode = previewStatus(effectiveLoaded, p.totalQuantity);
      let rowError = '';
      if (effectiveLoaded != null) {
        if (effectiveLoaded > p.totalQuantity) {
          rowError = `No puede superar lo esperado (${quantityText(p.totalQuantity)})`;
        } else if (effectiveLoaded < 0) {
          rowError = 'No puede ser negativo';
        } else if (effectiveLoaded < p.totalQuantity && !effectiveNote.trim()) {
          rowError = 'Indica el motivo del faltante';
        }
      }
      return {
        p,
        effectiveLoaded,
        effectiveNote,
        previewStatusCode,
        dirty: !!draft,
        error: rowError,
      };
    });
  });

  protected visibleRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const statusFilter = this.statusFilter();
    return this.rows().filter((r) => {
      if (statusFilter && r.previewStatusCode !== statusFilter) return false;
      if (!q) return true;
      return r.p.productCode.toLowerCase().includes(q) || r.p.productName.toLowerCase().includes(q);
    });
  });

  protected visibleVouchers = computed(() => {
    const q = this.voucherSearch().trim().toLowerCase();
    const invoices = this.detail()?.invoices ?? [];
    if (!q) return invoices;
    return invoices.filter(
      (v) =>
        v.invoiceId.toLowerCase().includes(q) || (v.customerName ?? '').toLowerCase().includes(q),
    );
  });

  /** Doc 93, sección 4.4: planillas cerradas con el modelo anterior, sin carga declarada por producto. */
  protected legacyClosed = computed(() => {
    const d = this.detail();
    if (!d?.pickingConfirmedAt) return false;
    const c = d.pickingCounts;
    return c.complete === 0 && c.shortLoaded === 0 && c.notLoaded === 0 && c.pending > 0;
  });

  protected pendingVisibleCount = computed(
    () => this.visibleRows().filter((r) => r.previewStatusCode === 'PENDING').length,
  );
  protected dirtyCount = computed(() => this.rows().filter((r) => r.dirty).length);
  protected hasErrors = computed(() => this.rows().some((r) => r.dirty && r.error));
  protected firstErrorProductId = computed(
    () => this.rows().find((r) => r.dirty && r.error)?.p.productId ?? null,
  );

  protected canCloseNow = computed(
    () => this.dirtyCount() === 0 && (this.detail()?.pickingCounts.pending ?? 1) === 0,
  );
  protected closeDisabledReason = computed(() => {
    if (this.dirtyCount() > 0) return 'Guarda los cambios antes de cerrar';
    const pending = this.detail()?.pickingCounts.pending ?? 0;
    if (pending > 0) return `Faltan ${pending} productos por revisar`;
    return '';
  });

  private loadEffect = effect(() => {
    if (this.batchId()) this.load();
  });

  protected batchDateText(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  protected countFor(code: string): number {
    const c = this.detail()?.pickingCounts;
    if (!c) return 0;
    if (code === 'PENDING') return c.pending;
    if (code === 'COMPLETE') return c.complete;
    if (code === 'SHORT') return c.shortLoaded;
    return c.notLoaded;
  }

  protected chipLabel(code: string): string {
    if (code === 'PENDING') return 'Pendientes';
    if (code === 'COMPLETE') return 'Completos';
    if (code === 'SHORT') return 'Faltantes';
    return 'No cargados';
  }

  protected toggleStatusFilter(code: string) {
    this.statusFilter.set(this.statusFilter() === code ? null : code);
  }

  protected onQtyInput(p: PickingProductConsolidatedView, ev: Event) {
    const raw = (ev.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.updateDraft(p, { loadedQuantity: Number.isNaN(value) ? null : value });
  }

  protected onNoteInput(p: PickingProductConsolidatedView, ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    this.updateDraft(p, { shortNote: value });
  }

  private updateDraft(p: PickingProductConsolidatedView, patch: Partial<Draft>) {
    this.drafts.update((cur) => {
      const current = cur[p.productId] ?? {
        loadedQuantity: p.loadedQuantity,
        shortNote: p.shortNote ?? '',
      };
      return { ...cur, [p.productId]: { ...current, ...patch } };
    });
  }

  protected markComplete(p: PickingProductConsolidatedView) {
    this.drafts.update((cur) => ({
      ...cur,
      [p.productId]: { loadedQuantity: p.totalQuantity, shortNote: '' },
    }));
  }

  protected bulkCompletePending() {
    const pendingRows = this.visibleRows().filter((r) => r.previewStatusCode === 'PENDING');
    if (pendingRows.length === 0) return;
    this.dialog
      .confirm({
        title: 'Marcar pendientes como completos',
        message: `Se marcarán ${pendingRows.length} productos como cargados completos. ¿Continuar?`,
        confirmLabel: 'Continuar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.drafts.update((cur) => {
          const next = { ...cur };
          for (const r of pendingRows)
            next[r.p.productId] = { loadedQuantity: r.p.totalQuantity, shortNote: '' };
          return next;
        });
      });
  }

  protected discardChanges() {
    this.drafts.set({});
  }

  protected onQtyEnter(ev: Event, productId: number) {
    ev.preventDefault();
    const ids = this.visibleRows().map((r) => r.p.productId);
    const idx = ids.indexOf(productId);
    const nextId = ids[idx + 1];
    if (nextId != null) {
      document.getElementById(`pk-qty-${nextId}`)?.focus();
    }
  }

  protected goToFirstError() {
    const id = this.firstErrorProductId();
    if (id == null) return;
    const el = document.querySelector(`[data-product-row="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById(`pk-qty-${id}`)?.focus();
  }

  protected printSheet() {
    window.print();
  }

  protected goToList() {
    this.router.navigate(['/reparto/picking']);
  }

  /** Usado por el guard `canDeactivate` de la ruta — avisa si hay cambios sin guardar. */
  hasUnsavedChanges(): boolean {
    return this.dirtyCount() > 0;
  }

  load() {
    const id = Number(this.batchId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.forbidden.set(false);
    this.notFound.set(false);
    this.pickingSvc.detail(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.drafts.set({});
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 403) this.forbidden.set(true);
        else if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
      },
    });
  }

  protected saveProgress() {
    const id = Number(this.batchId());
    if (!id || this.hasErrors()) return;
    const dirtyRows = this.rows().filter((r) => r.dirty);
    if (dirtyRows.length === 0) return;
    const items: PickingItemCommand[] = dirtyRows.map((r) => ({
      productId: r.p.productId,
      loadedQuantity: r.effectiveLoaded ?? 0,
      shortNote: (r.effectiveLoaded ?? 0) < r.p.totalQuantity ? r.effectiveNote : undefined,
    }));
    const cmd: DeclarePickingItemsCommand = { items };
    this.saving.set(true);
    this.pickingSvc.declareItems(id, cmd).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.drafts.set({});
        this.saving.set(false);
        this.toast.success('Avance guardado');
      },
      error: (err) => {
        this.saving.set(false);
        this.handleWriteError(err, true);
      },
    });
  }

  protected closePicking() {
    const d = this.detail();
    const id = Number(this.batchId());
    if (!d || !id) return;
    this.dialog
      .open(PickingCloseDialog, { data: { detail: d }, width: 'min(560px, 94vw)' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.closing.set(true);
        this.pickingSvc.confirm(id).subscribe({
          next: () => {
            this.closing.set(false);
            this.toast.success('Picking cerrado. La planilla ya puede salir a ruta.');
            this.load();
          },
          error: (err) => {
            this.closing.set(false);
            this.handleWriteError(err, true);
          },
        });
      });
  }

  private handleWriteError(err: unknown, reloadOn409: boolean) {
    const e = err as { status?: number; error?: { detail?: string } };
    if (e?.status === 403) {
      this.toast.error('No tienes permiso para esta acción.');
      return;
    }
    if (e?.status === 409) {
      this.toast.error(e.error?.detail || 'No se pudo completar la operación.');
      if (reloadOn409) this.load();
      return;
    }
    if (e?.status === 400) {
      this.toast.error(e.error?.detail || 'Revisa los datos ingresados.');
      return;
    }
    this.toast.error('No se pudo completar la operación. Intenta de nuevo.');
  }
}
