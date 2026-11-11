import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UiCheckbox } from '../../../shared/ui/checkbox/checkbox';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef, UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { StockCutsAdminService } from '../stock-cuts-admin';
import {
  ApplyStockCutsResult,
  StockCutCandidate,
  StockCutItem,
  StockCutMode,
  StockCutOutcome,
  StockCutPreview,
  StockCutResultCode,
} from '../../../shared/models/stock-cuts.models';
import { BillingValidationResult } from '../../../shared/models/billing-validation.models';
import { timeText } from '../../assignments/assignment-format';
import { formatSoles } from '../../../shared/pipes/money';
import { erpUploadScreenText } from '../../sales-reports/stock-validation-format';

const APPLY_CHUNK = 100;

const RESULT_LABEL: Record<StockCutResultCode, string> = {
  LINE_REMOVED: 'Se quitó la línea',
  ORDER_CANCELLED: 'Se anuló el pedido',
  ORDER_CHANGED: 'No se tocó',
  NOT_FOUND: 'No encontrado',
  BLOCKED: 'No se pudo',
  ERROR: 'Error inesperado · reintentar',
};

export interface StockCutDialogData {
  warehouseId: number;
  productId: number;
  /** Se llama cada vez que se aplica un recorte con éxito — puede pasar más de una vez si se usa "Volver a revisar" (doc 78, sección 4.6). */
  onApplied: (result: ApplyStockCutsResult) => void;
}

/** "Recortar negativos" — recorte de un producto, doc 78, sección 4.6. */
@Component({
  selector: 'app-stock-cut-dialog',
  imports: [UiButton, UiModal, UiCheckbox, UiEmpty],
  template: `
    <ui-modal
      [title]="'Recortar ' + (preview()?.productCode ?? '') + ' ' + (preview()?.productName ?? '')"
      [wide]="true"
      (close)="ref.close()"
    >
      @if (previewLoading() && !preview()) {
        <div class="scd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (previewError()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el recorte"
          actionLabel="Reintentar"
          (action)="runPreview()"
        />
      } @else if (applyResult(); as ar) {
        <div class="scd-result">
          <div class="scd-result-counts">
            <span class="scd-result-count">[ {{ ar.cutCount }} ] Recortados</span>
            <span class="scd-result-count">[ {{ ar.notCutCount }} ] Sin cambios</span>
            <span
              class="scd-result-shortfall"
              [class.scd-ok]="ar.shortfallAfter === 0"
              [class.scd-danger]="ar.shortfallAfter > 0"
            >
              Faltante ahora: {{ ar.shortfallAfter }} {{ ar.shortfallAfter === 0 ? '✓' : '' }}
            </span>
          </div>

          <div class="scd-result-list">
            @for (o of ar.orders; track o.orderId) {
              <div class="scd-result-row">
                <span class="scd-mono">{{ o.orderId }}</span>
                <span [class.scd-ok]="o.cut" [class.scd-warn]="!o.cut">
                  {{ o.cut ? '✓' : '⚠' }} {{ resultLabel(o.result)
                  }}{{ o.reason ? ' · ' + o.reason : '' }}
                </span>
              </div>
            }
          </div>

          <div class="scd-footer">
            @if (ar.shortfallAfter > 0) {
              <button uiButton variant="secondary" (click)="backToPreview()">
                Volver a revisar
              </button>
            }
            <button uiButton variant="primary" (click)="ref.close()">Cerrar</button>
          </div>
        </div>
      } @else if (preview(); as p) {
        <div class="scd-head">
          <span>Vendido hoy {{ p.soldQuantity }}</span>
          <span class="scd-sep">·</span>
          <span>
            ERP {{ p.erpQuantity ?? '—' }}
            @if (p.erpUploadedAt) {
              (subida {{ erpUploadScreenText(p.erpUploadedAt) }})
            }
          </span>
          <span class="scd-sep">·</span>
          <span class="scd-danger">Faltan {{ p.shortfall }}</span>
        </div>

        @if (p.olderOrdersNotInErp > 0) {
          <p class="scd-note">
            Hay {{ p.olderOrdersNotInErp }} pedido{{ p.olderOrdersNotInErp === 1 ? '' : 's' }} de
            días anteriores con este producto que el ERP todavía no subió: sus unidades siguen en el
            stock del ERP y no entran en la cuenta de hoy.
          </p>
        }

        @if (p.warnings.length > 0) {
          <div class="scd-warnings">
            @for (w of p.warnings; track $index) {
              <p>⚠ {{ w }}</p>
            }
          </div>
        }

        @if (p.shortfall === 0) {
          <div class="scd-ok-banner">Este producto ya no tiene faltante.</div>
        } @else {
          <div class="scd-mode">
            <button
              type="button"
              class="scd-mode-btn"
              [class.on]="mode() === 'AUTO'"
              (click)="setMode('AUTO')"
            >
              Automático
            </button>
            <button
              type="button"
              class="scd-mode-btn"
              [class.on]="mode() === 'SELECTED'"
              (click)="setMode('SELECTED')"
            >
              Elegir pedidos
            </button>
          </div>

          <p class="scd-summary">
            Se quitan {{ p.plannedQuantity }} de {{ p.plannedCount }} pedido{{
              p.plannedCount === 1 ? '' : 's'
            }}
            @if (plannedCancelCount() > 0) {
              ({{ plannedCancelCount() }} se anula{{ plannedCancelCount() === 1 ? '' : 'n' }})
            }
            @if (p.remainingShortfall > 0) {
              <span class="scd-danger">· Sigue faltando {{ p.remainingShortfall }}</span>
            } @else {
              <span class="scd-ok">· Faltante cubierto</span>
              @if (p.surplus > 0) {
                <span class="scd-muted">· Sobran {{ p.surplus }}</span>
              }
            }
          </p>
        }

        <div class="scd-table-wrap">
          <table class="ui-table-grid scd-table">
            <thead>
              <tr>
                <th></th>
                <th>N.º</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Cant.</th>
                <th>Línea</th>
                <th>Neto → Después</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of p.candidates; track c.orderId) {
                <tr [class.scd-row-planned]="c.planned">
                  <td>
                    <span
                      [title]="mode() === 'AUTO' ? 'Cambie a «Elegir pedidos» para marcar' : ''"
                    >
                      <ui-checkbox
                        label=""
                        [checked]="isSelected(c)"
                        [disabled]="mode() === 'AUTO'"
                        (checkedChange)="toggleCandidate(c.orderId)"
                      />
                    </span>
                  </td>
                  <td class="scd-mono">{{ c.orderId }}</td>
                  <td class="scd-muted">{{ timeText(c.orderDate) }}</td>
                  <td>{{ c.customerName }}</td>
                  <td class="scd-muted">{{ c.salespersonName }}</td>
                  <td class="scd-num">{{ c.quantity }}</td>
                  <td class="scd-num">{{ formatSoles(c.lineNetAmount) }}</td>
                  <td class="scd-num">
                    {{ formatSoles(c.orderNetAmount) }}
                    @if (c.planned) {
                      → {{ c.estimatedNetAfter != null ? formatSoles(c.estimatedNetAfter) : '—' }}
                      @if (c.action === 'CANCEL_ORDER') {
                        <span class="scd-danger">(Se anula)</span>
                      }
                    }
                  </td>
                  <td>
                    <button type="button" class="scd-link" (click)="goToOrder(c.orderId)">
                      Ir al pedido ›
                    </button>
                  </td>
                </tr>
                @if (c.planned && c.effects.length > 0) {
                  <tr class="scd-effects-row">
                    <td></td>
                    <td colspan="8">
                      @for (e of c.effects; track $index) {
                        <div
                          class="scd-effect"
                          [class.scd-warn]="
                            e.includes('Pierde') || e.includes('baja') || e.includes('Se anula')
                          "
                        >
                          · {{ e }}
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="scd-footer">
          <button uiButton variant="secondary" (click)="ref.close()">Cancelar</button>
          <button
            uiButton
            variant="primary"
            [disabled]="p.shortfall === 0 || p.plannedCount === 0 || applying()"
            [loading]="applying()"
            (click)="confirmApply()"
          >
            Aplicar recorte ({{ p.plannedCount }} pedidos)
          </button>
        </div>
      }
    </ui-modal>
  `,
  styles: [
    `
      .scd-skeleton {
        height: 300px;
        background: var(--faint);
      }
      .scd-head {
        display: flex;
        gap: var(--sp-2);
        flex-wrap: wrap;
        font-size: var(--fs-dense);
        color: var(--ink);
        margin-bottom: var(--sp-3);
      }
      .scd-sep {
        color: var(--ink-muted);
      }
      .scd-danger {
        color: var(--status-danger);
        font-weight: 700;
      }
      .scd-ok {
        color: var(--status-ok);
        font-weight: 700;
      }
      .scd-warn {
        color: var(--status-warn);
      }
      .scd-muted {
        color: var(--ink-muted);
      }
      .scd-note {
        margin: 0 0 var(--sp-3);
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .scd-warnings {
        margin-bottom: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        border-left: 3px solid var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
      }
      .scd-warnings p {
        margin: 0;
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .scd-warnings p + p {
        margin-top: 4px;
      }
      .scd-ok-banner {
        margin-bottom: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        border-left: 3px solid var(--status-ok);
        background: color-mix(in srgb, var(--status-ok) 10%, transparent);
        color: var(--ink);
        font-weight: 700;
      }
      .scd-mode {
        display: inline-flex;
        margin-bottom: var(--sp-3);
        border: 1px solid var(--divider);
        border-radius: var(--radius-control, 0);
        overflow: hidden;
      }
      .scd-mode-btn {
        appearance: none;
        border: 0;
        background: transparent;
        padding: 8px 16px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .scd-mode-btn.on {
        background: var(--accent-wash);
        color: var(--accent-ink);
      }
      .scd-summary {
        margin: 0 0 var(--sp-3);
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .scd-table-wrap {
        overflow-x: auto;
      }
      .scd-table {
        width: 100%;
      }
      .scd-mono {
        font-family: monospace;
      }
      .scd-num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .scd-row-planned {
        background: var(--accent-wash);
      }
      .scd-effects-row td {
        border-top: 0;
        padding-top: 0;
        padding-bottom: 8px;
      }
      .scd-effect {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .scd-link {
        appearance: none;
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
        white-space: nowrap;
      }
      .scd-link:hover {
        text-decoration: underline;
      }
      .scd-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-3);
        margin-top: var(--sp-5);
      }
      .scd-result-counts {
        display: flex;
        gap: var(--sp-4);
        flex-wrap: wrap;
        font-weight: 700;
        margin-bottom: var(--sp-4);
      }
      .scd-result-shortfall {
        margin-left: auto;
      }
      .scd-result-list {
        display: grid;
        gap: 6px;
      }
      .scd-result-row {
        display: flex;
        gap: var(--sp-3);
        font-size: var(--fs-dense);
      }
    `,
  ],
})
export class StockCutDialog {
  protected data = inject<StockCutDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
  private svc = inject(StockCutsAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected timeText = timeText;
  protected formatSoles = formatSoles;
  protected erpUploadScreenText = erpUploadScreenText;

  protected preview = signal<StockCutPreview | null>(null);
  protected previewLoading = signal(false);
  protected previewError = signal(false);
  protected mode = signal<StockCutMode>('AUTO');
  protected selectedIds = signal<Set<number>>(new Set());
  protected applying = signal(false);
  protected applyResult = signal<ApplyStockCutsResult | null>(null);

  private selectionChanged$ = new Subject<void>();

  protected plannedCancelCount = computed(
    () =>
      this.preview()?.candidates.filter((c) => c.planned && c.action === 'CANCEL_ORDER').length ??
      0,
  );

  constructor() {
    this.selectionChanged$.pipe(debounceTime(400), takeUntilDestroyed()).subscribe(() => {
      this.runPreview();
    });
    this.runPreview();
  }

  protected runPreview() {
    this.previewLoading.set(true);
    this.previewError.set(false);
    this.svc
      .preview({
        warehouseId: this.data.warehouseId,
        productId: this.data.productId,
        mode: this.mode(),
        orderIds: this.mode() === 'SELECTED' ? Array.from(this.selectedIds()) : undefined,
      })
      .subscribe({
        next: (p) => {
          this.preview.set(p);
          this.previewLoading.set(false);
        },
        error: () => {
          this.previewLoading.set(false);
          this.previewError.set(true);
        },
      });
  }

  protected setMode(next: StockCutMode) {
    if (this.mode() === next) return;
    if (next === 'SELECTED') {
      const planned = this.preview()?.candidates.filter((c) => c.planned) ?? [];
      this.selectedIds.set(new Set(planned.map((c) => c.orderId)));
    }
    this.mode.set(next);
    this.runPreview();
  }

  protected isSelected(c: StockCutCandidate): boolean {
    return this.mode() === 'AUTO' ? c.planned : this.selectedIds().has(c.orderId);
  }

  protected toggleCandidate(orderId: number) {
    if (this.mode() !== 'SELECTED') return;
    const next = new Set(this.selectedIds());
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    this.selectedIds.set(next);
    this.selectionChanged$.next();
  }

  protected goToOrder(orderId: number) {
    this.ref.close();
    this.router.navigate(['/pedidos/editar', orderId], {
      queryParams: { returnTo: 'validacion-facturacion' },
    });
  }

  protected resultLabel(code: StockCutResultCode): string {
    return RESULT_LABEL[code];
  }

  protected backToPreview() {
    this.applyResult.set(null);
    this.mode.set('AUTO');
    this.selectedIds.set(new Set());
    this.runPreview();
  }

  protected confirmApply() {
    const p = this.preview();
    if (!p || p.plannedCount === 0 || this.applying()) return;
    const cancelCount = this.plannedCancelCount();
    const lineOnlyCount = p.plannedCount - cancelCount;
    const message =
      cancelCount > 0
        ? `Se quitará la línea completa de ${lineOnlyCount} pedido${lineOnlyCount === 1 ? '' : 's'} y se anulará${cancelCount === 1 ? '' : 'n'} ${cancelCount} pedido${cancelCount === 1 ? '' : 's'} (su única línea era este producto). Los pedidos recalculan sus promociones. No se puede deshacer.`
        : `Se quitará la línea completa de ${p.plannedCount} pedido${p.plannedCount === 1 ? '' : 's'}. Los pedidos recalculan sus promociones. No se puede deshacer.`;
    this.dialog
      .confirm({
        title: `¿Recortar ${p.productCode} ${p.productName}?`,
        message,
        confirmLabel: 'Aplicar recorte',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed || this.applying()) return;
        this.applyNow(p);
      });
  }

  private applyNow(p: StockCutPreview) {
    this.applying.set(true);
    const items: StockCutItem[] = p.candidates
      .filter((c) => c.planned)
      .map((c) => ({ orderId: c.orderId, expectedQuantity: c.quantity }));
    const empty: ApplyStockCutsResult = {
      productId: p.productId,
      requested: 0,
      cutCount: 0,
      notCutCount: 0,
      cutQuantity: 0,
      shortfallAfter: p.shortfall,
      intakeOpen: p.intakeOpen,
      warnings: [],
      orders: [],
      validation: null,
    };
    this.runApplyChunks(p, items, 0, empty);
  }

  private runApplyChunks(
    p: StockCutPreview,
    items: StockCutItem[],
    index: number,
    acc: ApplyStockCutsResult,
  ) {
    if (index >= items.length) {
      this.applying.set(false);
      this.applyResult.set(acc);
      this.toast.success(
        `Recorte aplicado: ${acc.cutCount} pedido${acc.cutCount === 1 ? '' : 's'}`,
      );
      this.data.onApplied(acc);
      return;
    }
    const chunk = items.slice(index, index + APPLY_CHUNK);
    this.svc
      .apply({ warehouseId: this.data.warehouseId, productId: p.productId, items: chunk })
      .subscribe({
        next: (result) => {
          const merged: ApplyStockCutsResult = {
            ...result,
            requested: acc.requested + result.requested,
            cutCount: acc.cutCount + result.cutCount,
            notCutCount: acc.notCutCount + result.notCutCount,
            cutQuantity: acc.cutQuantity + result.cutQuantity,
            orders: [...acc.orders, ...result.orders] as StockCutOutcome[],
            warnings: [...acc.warnings, ...result.warnings],
            validation: this.mergeValidation(acc.validation, result.validation),
          };
          this.runApplyChunks(p, items, index + APPLY_CHUNK, merged);
        },
        error: () => {
          this.applying.set(false);
          this.toast.error('No pudimos aplicar el recorte.');
        },
      });
  }

  private mergeValidation(
    a: BillingValidationResult | null,
    b: BillingValidationResult | null,
  ): BillingValidationResult | null {
    if (!a) return b;
    if (!b) return a;
    return {
      ...b,
      orders: [...a.orders, ...b.orders],
      notFoundOrderIds: [...a.notFoundOrderIds, ...b.notFoundOrderIds],
    };
  }
}
