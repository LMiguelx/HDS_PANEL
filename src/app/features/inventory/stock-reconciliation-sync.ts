import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { InventoryAdminService } from './inventory-admin';
import { ReconciliationRow, SyncProductResultFilter } from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  SYNC_PRODUCT_RESULT_OPTIONS,
  reasonLabel,
  reasonTone,
} from './inventory-format';

const PAGE_SIZE = 50;

/**
 * Productos de una actualización del ERP — doc 56, sección 9.4. Solo los
 * productos con diferencia se muestran por defecto; cada uno trae su
 * "Por qué" ya resuelto por el servidor.
 */
@Component({
  selector: 'app-stock-reconciliation-sync',
  imports: [RouterLink, UiButton, UiField, UiEmpty, UiInfoTip],
  template: `
    <section class="esp-page">
      <button uiButton variant="ghost" size="sm" routerLink="/inventario/cuadre" class="esp-back">
        ← Actualizaciones
      </button>
      <h1>Actualización del ERP · {{ startedAtText() }} · {{ warehouseName() }}</h1>
      <p class="esp-sub">
        {{ productCount() }} productos · {{ matchedCount() }} cuadraron ·
        {{ increasedCount() }} entró mercadería · {{ decreasedCount() }} la app tenía de más
        @if (failedCount() > 0) {
          · {{ failedCount() }} fallaron
        }
      </p>

      <div class="esp-filters">
        <ui-field
          label="Resultado"
          type="select"
          [(value)]="resultFilter"
          [options]="resultOptions"
        />
        <ui-field
          label="Buscar en esta actualización"
          icon="search"
          placeholder="Código o nombre"
          [(value)]="searchQuery"
        />
      </div>

      @if (loading()) {
        <div class="esp-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar los productos"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (filteredRows().length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          [title]="
            resultFilter() === 'DIFFERENCE'
              ? 'En esta actualización todo cuadró.'
              : 'Sin productos para este filtro.'
          "
        />
      } @else {
        <table class="ui-table-grid esp-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>
                ERP <span [uiInfoTip]="'Lo que informó el ERP en esta actualización.'"></span>
              </th>
              <th>
                App tenía
                <span
                  [uiInfoTip]="'El stock de la app justo antes de alinearse con el ERP.'"
                ></span>
              </th>
              <th>
                Ajuste
                <span [uiInfoTip]="'Lo que la app sumó o restó para quedar igual al ERP.'"></span>
              </th>
              <th>Por qué</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of filteredRows(); track row.reconciliation.uploadId) {
              <tr class="esp-row" (click)="openDetail(row)">
                <td>
                  {{ row.reconciliation.productName }}
                  <div class="esp-muted">{{ row.reconciliation.productCode }}</div>
                </td>
                <td class="esp-num">{{ row.reconciliation.erpQuantity ?? '—' }}</td>
                <td class="esp-num">
                  {{
                    row.reconciliation.statusCode === 'FAILED'
                      ? '—'
                      : row.reconciliation.stockBefore
                  }}
                </td>
                <td class="esp-num esp-qty" [style.color]="adjustmentColor(row)">
                  @if (row.reconciliation.appliedDelta != null) {
                    {{ row.reconciliation.appliedDelta > 0 ? '+' : ''
                    }}{{ row.reconciliation.appliedDelta }}
                  } @else {
                    —
                  }
                </td>
                <td class="esp-reason" [title]="row.explanation.reasonText">
                  <span class="esp-badge" [style.color]="'var(' + toneVar(row) + ')'">{{
                    reasonLabel(row.explanation.reason)
                  }}</span>
                  <span class="esp-reason-text">{{ row.explanation.reasonText }}</span>
                </td>
                <td class="esp-chevron">›</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="esp-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="esp-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .esp-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .esp-back {
        margin-bottom: 12px;
      }
      h1 {
        font: var(--fw-h1, var(--fw-display)) var(--fs-h1, var(--fs-display)) /
          var(--lh-h1, var(--lh-display)) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .esp-sub {
        margin: 0 0 20px;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .esp-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .esp-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .esp-table {
        width: 100%;
      }
      .esp-row {
        cursor: pointer;
      }
      .esp-row:hover {
        background: var(--faint);
      }
      .esp-muted {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .esp-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .esp-qty {
        font-weight: 800;
      }
      .esp-reason {
        max-width: 420px;
      }
      .esp-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        margin-right: 8px;
        white-space: nowrap;
      }
      .esp-reason-text {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .esp-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }
      .esp-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 20px;
      }
      .esp-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .esp-page {
          padding: var(--sp-4);
        }
        .esp-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class StockReconciliationSyncPage {
  private inventorySvc = inject(InventoryAdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected dateTimeText = dateTimeText;
  protected resultOptions = SYNC_PRODUCT_RESULT_OPTIONS;
  protected reasonLabel = reasonLabel;
  protected toneVar = (row: ReconciliationRow) =>
    BADGE_TONE_VAR[reasonTone(row.explanation.reason)];

  private qp = this.route.snapshot.queryParamMap;
  private firstUploadId = Number(this.qp.get('firstUploadId'));
  private lastUploadId = Number(this.qp.get('lastUploadId'));
  private warehouseIdParam = this.qp.get('warehouseId');

  protected warehouseName = signal(this.qp.get('warehouseName') ?? '');
  protected startedAtText = computed(() => {
    const v = this.qp.get('startedAt');
    return v ? dateTimeText(v) : '';
  });
  protected productCount = signal(Number(this.qp.get('productCount') ?? 0));
  protected matchedCount = signal(Number(this.qp.get('matchedCount') ?? 0));
  protected increasedCount = signal(Number(this.qp.get('increasedCount') ?? 0));
  protected decreasedCount = signal(Number(this.qp.get('decreasedCount') ?? 0));
  protected failedCount = signal(Number(this.qp.get('failedCount') ?? 0));

  protected resultFilter = signal<SyncProductResultFilter | ''>('DIFFERENCE');
  protected searchQuery = signal('');
  protected page = signal(0);
  protected totalPages = signal(0);
  protected rows = signal<ReconciliationRow[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  protected filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(
      (r) =>
        r.reconciliation.productName.toLowerCase().includes(q) ||
        r.reconciliation.productCode.toLowerCase().includes(q),
    );
  });

  private resultEffect = effect(() => {
    this.resultFilter();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  constructor() {
    if (!this.firstUploadId || !this.lastUploadId) {
      this.router.navigate(['/inventario/cuadre']);
    }
  }

  load() {
    if (!this.firstUploadId || !this.lastUploadId) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc
      .syncProducts({
        firstUploadId: this.firstUploadId,
        lastUploadId: this.lastUploadId,
        warehouseId: this.warehouseIdParam ? Number(this.warehouseIdParam) : undefined,
        result: this.resultFilter() || undefined,
        page: this.page(),
        size: PAGE_SIZE,
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.totalPages.set(result.totalPages ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
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

  protected adjustmentColor(row: ReconciliationRow): string {
    const delta = row.reconciliation.appliedDelta ?? 0;
    if (delta > 0) return 'var(--st-open)';
    if (delta < 0) return 'var(' + BADGE_TONE_VAR[reasonTone(row.explanation.reason)] + ')';
    return 'var(--ink-muted)';
  }

  protected openDetail(row: ReconciliationRow) {
    this.router.navigate(['/inventario/cuadre', row.reconciliation.uploadId]);
  }
}
