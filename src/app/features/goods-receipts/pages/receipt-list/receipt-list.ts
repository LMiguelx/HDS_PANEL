import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiInfoTip } from '../../../../shared/ui/info-tip/info-tip';
import { GoodsReceiptsApi } from '../../data-access/goods-receipts.api';
import { CatalogLookupService } from '../../../catalog/catalog-lookup';
import { LookupService, toUiLookup } from '../../../promos/lookup';
import {
  ReceiptBrandOption,
  ReceiptListFilters,
  ReceiptSummary,
} from '../../domain/goods-receipt.models';
import { WarehouseView } from '../../../../shared/models/inventory.models';
import {
  BADGE_TONE_VAR,
  STATUS_OPTIONS,
  STATUS_TONE,
  documentSummaryText,
} from '../../domain/goods-receipt.format';
import { dateTimeText } from '../../../assignments/assignment-format';
import { formatSoles } from '../../../../shared/pipes/money';

const ERP_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Tomadas por el ERP' },
  { value: 'false', label: 'No tomadas' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Entregas — doc 58, sección 6. Documentos de entrega de las marcas leídos
 * por foto en la app de almacén. `goods_receipt.view` o `.manage`. Los
 * filtros se reflejan en la URL para conservarlos al volver del detalle.
 */
@Component({
  selector: 'app-receipt-list',
  imports: [UiButton, UiField, UiTypeahead, UiEmpty, UiInfoTip],
  template: `
    <section class="rl-page">
      <div class="rl-head">
        <div>
          <h1>Recepción de mercadería · Entregas</h1>
          <p class="rl-sub">
            Documentos de entrega de las marcas leídos por foto en la app de almacén.
          </p>
        </div>
        <button uiButton variant="ghost" (click)="load()" [loading]="loading()">
          ↻ Actualizar
        </button>
      </div>

      <div class="rl-chips">
        <button type="button" class="rl-chip" (click)="applyInReviewChip()">En revisión</button>
        <button type="button" class="rl-chip" (click)="applyErpPendingChip()">
          Pendientes del ERP
        </button>
      </div>

      <div class="rl-filters">
        <ui-field
          label="Buscar"
          icon="search"
          placeholder="Documento o proveedor"
          [(value)]="searchQuery"
        />
        <ui-field label="Marca" type="select" [(value)]="brandId" [options]="brandOptions()" />
        <ui-field label="Estado" type="select" [(value)]="statusCode" [options]="statusOptions" />
        <ui-typeahead
          label="Subido por"
          placeholder="Todos"
          [clearOnPick]="false"
          [search]="userSearch"
          [(selected)]="createdBy"
        />
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="warehouseId"
          [options]="warehouseOptions()"
        />
        <ui-field label="ERP" type="select" [(value)]="erpTaken" [options]="erpOptions" />
        <ui-field label="Desde" type="date" [(value)]="fromDate" />
        <ui-field label="Hasta" type="date" [(value)]="toDate" />
      </div>

      @if (loading()) {
        <div class="rl-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las entregas"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (rows().length === 0) {
        <ui-empty
          [title]="
            hasFilters()
              ? 'No hay entregas con estos filtros.'
              : 'Hoy todavía no se subieron entregas.'
          "
        />
      } @else {
        <table class="ui-table-grid rl-table">
          <thead>
            <tr>
              <th>N.°</th>
              <th>Fecha</th>
              <th>Marca</th>
              <th>Documento</th>
              <th>Proveedor</th>
              <th>Líneas</th>
              <th>
                Subtotal
                <span
                  [uiInfoTip]="'Suma de los subtotales de las líneas, sin bonificaciones.'"
                ></span>
              </th>
              <th>Subido por</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.receiptId) {
              <tr class="rl-row" (click)="openDetail(r)">
                <td class="rl-cell-strong">{{ r.receiptId }}</td>
                <td class="rl-muted" [title]="dateTimeText(r.createdAt)">
                  {{ shortDate(r.createdAt) }}
                </td>
                <td>{{ r.brandName }}</td>
                <td [class.rl-muted]="!r.documentTypeName && !r.documentNumber">
                  {{ documentSummaryText(r.documentTypeName, r.documentNumber) }}
                </td>
                <td class="rl-muted">{{ r.supplierName || '—' }}</td>
                <td class="rl-num">{{ r.lineCount }}</td>
                <td class="rl-num">{{ formatSoles(r.linesSubtotal) }}</td>
                <td class="rl-muted">{{ r.createdByName }}</td>
                <td>
                  <span class="rl-badge" [style.color]="'var(' + statusTone(r) + ')'">{{
                    r.statusName
                  }}</span>
                  @if (r.statusCode === 'CONFIRMED') {
                    <div class="rl-erp-tag" [class.rl-erp-tag-done]="r.erpTaken">
                      {{ r.erpTaken ? '✓ Tomada por el ERP' : 'Pendiente del ERP' }}
                    </div>
                  }
                </td>
                <td class="rl-chevron">›</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="rl-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="rl-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .rl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rl-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .rl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
        max-width: 620px;
      }
      .rl-chips {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }
      .rl-chip {
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        padding: 7px 14px;
        border: 1px solid var(--hairline);
        background: var(--bg);
        color: var(--ink);
        cursor: pointer;
      }
      .rl-chip:hover {
        border-color: var(--accent);
      }
      .rl-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .rl-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .rl-table {
        width: 100%;
      }
      .rl-row {
        cursor: pointer;
      }
      .rl-row:hover {
        background: var(--faint);
      }
      .rl-cell-strong {
        font-weight: 800;
      }
      .rl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .rl-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .rl-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .rl-erp-tag {
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .rl-erp-tag-done {
        color: var(--st-vigente);
        font-weight: 700;
      }
      .rl-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }
      .rl-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 20px;
      }
      .rl-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .rl-page {
          padding: var(--sp-4);
        }
        .rl-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class ReceiptListPage {
  private api = inject(GoodsReceiptsApi);
  private catalogSvc = inject(CatalogLookupService);
  private lookupSvc = inject(LookupService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected documentSummaryText = documentSummaryText;
  protected statusOptions = STATUS_OPTIONS;
  protected erpOptions = ERP_OPTIONS;
  protected statusTone = (r: ReceiptSummary) => BADGE_TONE_VAR[STATUS_TONE[r.statusCode]];

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  private qp = this.route.snapshot.queryParamMap;
  protected searchQuery = signal(this.qp.get('q') ?? '');
  protected brandId = signal(this.qp.get('brandId') ?? '');
  protected statusCode = signal(this.qp.get('statusCode') ?? '');
  protected createdBy = signal<UiLookupItem | null>(null);
  protected warehouseId = signal(this.qp.get('warehouseId') ?? '');
  protected erpTaken = signal(this.qp.get('erpTaken') ?? '');
  protected fromDate = signal(this.qp.get('from') ?? (this.qp.get('statusCode') ? '' : todayIso()));
  protected toDate = signal(this.qp.get('to') ?? (this.qp.get('statusCode') ? '' : todayIso()));
  protected page = signal(Number(this.qp.get('page') ?? 0));

  protected brands = signal<ReceiptBrandOption[]>([]);
  protected warehouses = signal<WarehouseView[]>([]);

  protected brandOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todas' },
    ...this.brands().map((b) => ({ value: String(b.brandId), label: b.brandName })),
  ]);
  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  protected hasFilters = computed(
    () =>
      !!this.searchQuery() ||
      !!this.brandId() ||
      !!this.statusCode() ||
      !!this.createdBy() ||
      !!this.warehouseId() ||
      !!this.erpTaken() ||
      !!this.fromDate() ||
      !!this.toDate(),
  );

  protected loading = signal(true);
  protected error = signal(false);
  protected rows = signal<ReceiptSummary[]>([]);
  protected totalPages = signal(0);

  private currentFilters(): ReceiptListFilters {
    return {
      brandId: this.brandId() ? Number(this.brandId()) : undefined,
      warehouseId: this.warehouseId() ? Number(this.warehouseId()) : undefined,
      createdBy: this.createdBy()?.id,
      statusCode: (this.statusCode() || undefined) as ReceiptListFilters['statusCode'],
      q: this.searchQuery() || undefined,
      erpTaken: this.erpTaken() === '' ? undefined : this.erpTaken() === 'true',
      from: this.fromDate() || undefined,
      to: this.toDate() || undefined,
      page: this.page(),
      size: 20,
    };
  }

  // Un solo efecto reacciona a filtros y página — ARCHITECTURE_PANEL.md,
  // 8.1: al cambiar un filtro vuelve a la página 0 (sin recargar dos veces:
  // el reset dispara al efecto de nuevo, y recién ahí carga).
  private previousFiltersKey = '';
  private mainEffect = effect(() => {
    const key = JSON.stringify([
      this.searchQuery(),
      this.brandId(),
      this.statusCode(),
      this.createdBy()?.id ?? null,
      this.warehouseId(),
      this.erpTaken(),
      this.fromDate(),
      this.toDate(),
    ]);
    const page = this.page();
    untracked(() => {
      if (key !== this.previousFiltersKey) {
        this.previousFiltersKey = key;
        if (page !== 0) {
          this.page.set(0);
          return;
        }
      }
      this.load();
      this.syncUrl();
    });
  });

  constructor() {
    this.catalogSvc.warehouses().subscribe((list) => this.warehouses.set(list));
    this.api.brandOptions().subscribe((list) => this.brands.set(list));

    const cbId = this.qp.get('createdBy');
    if (cbId) this.createdBy.set({ id: Number(cbId), name: this.qp.get('createdByName') ?? '' });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.list(this.currentFilters()).subscribe({
      next: (r) => {
        this.rows.set(r.content ?? []);
        this.totalPages.set(r.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private syncUrl() {
    const f = this.currentFilters();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: f.q ?? null,
        brandId: f.brandId ?? null,
        statusCode: f.statusCode ?? null,
        createdBy: f.createdBy ?? null,
        createdByName: this.createdBy()?.name || null,
        warehouseId: f.warehouseId ?? null,
        erpTaken: f.erpTaken ?? null,
        from: f.from ?? null,
        to: f.to ?? null,
        page: f.page || null,
      },
      replaceUrl: true,
    });
  }

  protected shortDate(iso: string): string {
    return dateTimeText(iso).replace(/^(\d{2}\/\d{2})\/\d{4}/, '$1');
  }

  protected applyInReviewChip() {
    this.statusCode.set('IN_REVIEW');
    this.erpTaken.set('');
    this.fromDate.set('');
    this.toDate.set('');
  }

  protected applyErpPendingChip() {
    this.statusCode.set('CONFIRMED');
    this.erpTaken.set('false');
    this.fromDate.set('');
    this.toDate.set('');
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
  }
  protected nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
  }

  protected openDetail(r: ReceiptSummary) {
    this.router.navigate(['/recepcion-mercaderia/entregas', r.receiptId]);
  }
}
