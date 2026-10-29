import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryAdminService } from './inventory-admin';
import { AuthService } from '../../core/auth/auth';
import { ToastService } from '../../core/ui/toast';
import {
  StockReconciliationDetail,
  StockReconciliationView,
} from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  failureReasonText,
  movementReference,
  reasonLabel,
  reasonTone,
} from './inventory-format';

/**
 * Detalle de un cuadre — doc 56, sección 9.5. Muestra la historia sumada:
 * qué hizo el ERP y qué hizo la app, no una lista cruda de movimientos. El
 * endpoint es el mismo de doc 35; solo gana `explanation`.
 */
@Component({
  selector: 'app-stock-reconciliation-detail',
  imports: [RouterLink, UiButton, UiEmpty],
  template: `
    <section class="erd-page">
      <button uiButton variant="ghost" size="sm" routerLink="/inventario/cuadre" class="erd-back">
        ← Volver
      </button>

      @if (loading()) {
        <div class="erd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No se encontró ese cuadre"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (detail(); as d) {
        <div class="erd-head">
          <div>
            <h1>{{ d.reconciliation.productName }} · {{ d.reconciliation.productCode }}</h1>
            <p class="erd-sub">
              Actualización del ERP {{ dateTimeText(d.reconciliation.uploadedAt) }}
            </p>
          </div>
        </div>

        @if (d.reconciliation.statusCode === 'FAILED') {
          <div class="erd-fail-box">
            <span>{{ failureText(d.reconciliation.failureCode) }}</span>
            @if (canManage()) {
              <button
                uiButton
                variant="secondary"
                size="sm"
                [loading]="retrying()"
                (click)="retry(d.reconciliation)"
              >
                Reintentar
              </button>
            }
          </div>
        } @else {
          <p class="erd-reason-line">
            <span class="erd-badge" [style.color]="'var(' + toneVar(d) + ')'">{{
              reasonLabel(d.explanation.reason)
            }}</span>
            — {{ d.explanation.reasonText }}
          </p>

          @if (d.explanation.previousUploadAt == null) {
            <p class="erd-first-sync">Primera subida: alinea la app con el ERP.</p>
          }

          @if (
            d.reconciliation.advanceCoveredQuantity && d.reconciliation.advanceCoveredQuantity > 0
          ) {
            <p class="erd-advance-line">
              Cubrió un adelanto de {{ d.reconciliation.advanceCoveredQuantity }}
            </p>
          }

          <div class="erd-breakdown">
            <div class="erd-col">
              <div class="erd-col-title">El ERP</div>
              @if (d.explanation.previousUploadAt != null) {
                <div class="erd-row">
                  <span
                    >Actualización anterior ({{
                      dateTimeText(d.explanation.previousUploadAt)
                    }})</span
                  >
                  <strong>{{ d.explanation.previousErpQuantity }}</strong>
                </div>
                <div class="erd-row">
                  <span>Cambio</span>
                  <strong
                    [class.erd-positive]="(d.explanation.erpChange ?? 0) > 0"
                    [class.erd-negative]="(d.explanation.erpChange ?? 0) < 0"
                  >
                    {{ (d.explanation.erpChange ?? 0) > 0 ? '+' : '' }}{{ d.explanation.erpChange }}
                  </strong>
                </div>
              }
              <div class="erd-row">
                <span>Ahora</span>
                <strong>{{ d.reconciliation.erpQuantity }}</strong>
              </div>
            </div>

            <div class="erd-col">
              <div class="erd-col-title">La app</div>
              @if (d.explanation.previousUploadAt != null) {
                <div class="erd-row">
                  <span>Después del cuadre anterior</span>
                  <strong>{{ d.explanation.appAfterPrevious }}</strong>
                </div>
              }
              @if (d.explanation.ordersQuantity !== 0) {
                <div class="erd-row">
                  <span>Pedidos</span>
                  <strong
                    [class.erd-positive]="d.explanation.ordersQuantity > 0"
                    [class.erd-negative]="d.explanation.ordersQuantity < 0"
                  >
                    {{ d.explanation.ordersQuantity > 0 ? '+' : ''
                    }}{{ d.explanation.ordersQuantity }}
                  </strong>
                </div>
                @if (d.explanation.ordersReturnedQuantity > 0) {
                  <div class="erd-row erd-row-sub">
                    <span
                      >de lo cual +{{ d.explanation.ordersReturnedQuantity }} volvió por ediciones o
                      anulaciones</span
                    >
                  </div>
                }
              }
              @if (d.explanation.advancesQuantity !== 0) {
                <div class="erd-row">
                  <span>Adelantos</span>
                  <strong
                    [class.erd-positive]="d.explanation.advancesQuantity > 0"
                    [class.erd-negative]="d.explanation.advancesQuantity < 0"
                  >
                    {{ d.explanation.advancesQuantity > 0 ? '+' : ''
                    }}{{ d.explanation.advancesQuantity }}
                  </strong>
                </div>
              }
              @if (d.explanation.manualQuantity !== 0) {
                <div class="erd-row">
                  <span
                    >Ajustes manuales{{
                      d.explanation.lastManualAdjustmentBy
                        ? ' (' + d.explanation.lastManualAdjustmentBy + ')'
                        : ''
                    }}</span
                  >
                  <strong
                    [class.erd-positive]="d.explanation.manualQuantity > 0"
                    [class.erd-negative]="d.explanation.manualQuantity < 0"
                  >
                    {{ d.explanation.manualQuantity > 0 ? '+' : ''
                    }}{{ d.explanation.manualQuantity }}
                  </strong>
                </div>
              }
              @if (d.explanation.otherQuantity !== 0) {
                <div class="erd-row">
                  <span>Otros</span>
                  <strong
                    [class.erd-positive]="d.explanation.otherQuantity > 0"
                    [class.erd-negative]="d.explanation.otherQuantity < 0"
                  >
                    {{ d.explanation.otherQuantity > 0 ? '+' : ''
                    }}{{ d.explanation.otherQuantity }}
                  </strong>
                </div>
              }
              @if (d.explanation.unrecordedQuantity !== 0) {
                <div class="erd-row erd-row-danger">
                  <span>Cambio sin registro</span>
                  <strong>{{ d.explanation.unrecordedQuantity }}</strong>
                </div>
              }
              <div class="erd-row erd-row-rule">
                <span>Tenía al actualizar</span>
                <strong>{{ d.reconciliation.stockBefore }}</strong>
              </div>
              <div class="erd-row">
                <span>Ajuste del cuadre</span>
                <strong
                  [class.erd-positive]="(d.reconciliation.appliedDelta ?? 0) > 0"
                  [class.erd-negative]="(d.reconciliation.appliedDelta ?? 0) < 0"
                >
                  {{ (d.reconciliation.appliedDelta ?? 0) > 0 ? '+' : ''
                  }}{{ d.reconciliation.appliedDelta }}
                </strong>
              </div>
              <div class="erd-row">
                <span>Quedó en</span>
                <strong>{{ d.reconciliation.stockAfter }}</strong>
              </div>
            </div>
          </div>
        }

        <div class="erd-movements">
          <button type="button" class="erd-toggle" (click)="showMovements.set(!showMovements())">
            {{ showMovements() ? '▾' : '▸' }} Ver movimientos
          </button>
          @if (showMovements()) {
            @if (d.movements.length === 0) {
              <ui-empty title="Sin movimientos registrados" />
            } @else {
              <table class="ui-table-grid erd-movements-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Origen</th>
                    <th>Nota</th>
                    <th>Hecho por</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of d.movements; track m.stockMovementId) {
                    <tr>
                      <td class="erd-muted">{{ dateTimeText(m.createdAt) }}</td>
                      <td>{{ m.movementTypeName }}</td>
                      <td
                        [class.erd-positive]="m.quantity > 0"
                        [class.erd-negative]="m.quantity < 0"
                        class="erd-qty"
                      >
                        {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                      </td>
                      <td>
                        @if (ref(m).route) {
                          <a [routerLink]="ref(m).route" class="erd-link">{{ ref(m).text }}</a>
                        } @else {
                          <span class="erd-muted">{{ ref(m).text }}</span>
                        }
                      </td>
                      <td class="erd-muted">{{ m.note || '—' }}</td>
                      <td class="erd-muted">{{ m.createdByName || 'Automático' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>

        <button
          uiButton
          variant="ghost"
          size="sm"
          [routerLink]="['/inventario/kardex', d.reconciliation.productId]"
          [queryParams]="{ warehouseId: d.reconciliation.warehouseId }"
        >
          Ver kardex completo
        </button>
      }
    </section>
  `,
  styles: [
    `
      .erd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .erd-back {
        margin-bottom: 12px;
      }
      h1 {
        font: var(--fw-h1, var(--fw-display)) var(--fs-h1, var(--fs-display)) /
          var(--lh-h1, var(--lh-display)) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .erd-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .erd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .erd-fail-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--st-mismatch);
        background: color-mix(in srgb, var(--st-mismatch) 8%, transparent);
        padding: 12px 14px;
        margin: 16px 0;
        font-size: 13px;
      }
      .erd-reason-line {
        margin: 16px 0 4px;
        font-size: 14px;
        color: var(--ink);
      }
      .erd-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
      }
      .erd-first-sync {
        margin: 0 0 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .erd-advance-line {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: 700;
        color: var(--st-open);
      }
      .erd-breakdown {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 32px;
        margin: 16px 0 24px;
        border: 1px solid var(--hairline);
        padding: 16px;
      }
      .erd-col {
        display: grid;
        gap: 8px;
        align-content: start;
      }
      .erd-col-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 4px;
      }
      .erd-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .erd-row strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .erd-row-sub {
        font-size: 12px;
        padding-left: 12px;
      }
      .erd-row-danger {
        color: var(--st-mismatch);
      }
      .erd-row-danger strong {
        color: var(--st-mismatch);
      }
      .erd-row-rule {
        border-top: 1px dashed var(--hairline);
        padding-top: 8px;
        margin-top: 2px;
      }
      .erd-positive {
        color: var(--st-open) !important;
      }
      .erd-negative {
        color: var(--st-mismatch) !important;
      }
      .erd-movements {
        margin-bottom: 20px;
      }
      .erd-toggle {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 13px;
        color: var(--ink);
        padding: 8px 0;
      }
      .erd-movements-table {
        width: 100%;
        margin-top: 8px;
      }
      .erd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .erd-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .erd-link {
        font-size: 13px;
        color: var(--accent-ink);
      }

      @media (max-width: 767px) {
        .erd-page {
          padding: var(--sp-4);
        }
        .erd-breakdown {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StockReconciliationDetailPage {
  private inventorySvc = inject(InventoryAdminService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  uploadId = input.required<string>();

  protected dateTimeText = dateTimeText;
  protected reasonLabel = reasonLabel;
  protected failureText = failureReasonText;
  protected canManage = computed(() => this.auth.hasAny('stock.advance'));
  protected toneVar = (d: StockReconciliationDetail) =>
    BADGE_TONE_VAR[reasonTone(d.explanation.reason)];
  protected ref = (m: { referenceTable: string | null; referenceId: string | null }) =>
    movementReference(m.referenceTable, m.referenceId);

  protected detail = signal<StockReconciliationDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected retrying = signal(false);
  protected showMovements = signal(false);

  constructor() {
    this.load();
  }

  load() {
    const id = Number(this.uploadId());
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc.reconciliationDetail(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected retry(row: StockReconciliationView) {
    this.retrying.set(true);
    this.inventorySvc.retryReconciliation(row.uploadId).subscribe({
      next: () => {
        this.retrying.set(false);
        this.toast.success('Reintento enviado');
        this.load();
      },
      error: () => {
        this.retrying.set(false);
        this.toast.error('No pudimos reintentar la subida.');
      },
    });
  }
}
