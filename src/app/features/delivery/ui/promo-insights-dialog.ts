import { Component, inject, signal } from '@angular/core';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { DeliveryAdminService } from '../delivery-admin';
import { BenefitInsight, PromoInsight } from '../../../shared/models/delivery.models';
import { measureTypeName } from '../delivery-format';
import { formatSoles } from '../../../shared/pipes/money';
import { quantityText } from '../../sales-reports/sales-report-format';

export interface PromoInsightsDialogData {
  invoiceId: string;
  customerName: string;
}

/**
 * Panel "Promociones" de un comprobante — doc 53, sección 12. Solo lectura:
 * tramos, cuánto mide hoy el comprobante y lo que el cliente conserva
 * (bonificaciones, sustitutos y descuentos), con el descuento perdido de
 * cada promoción si lo hay.
 */
@Component({
  selector: 'app-promo-insights-dialog',
  imports: [UiEmpty],
  template: `
    <div class="pid">
      <div class="pid-head">
        <div>
          <h2 class="pid-title">Promociones</h2>
          <p class="pid-subtitle">{{ data.invoiceId }} · {{ data.customerName }}</p>
        </div>
        <button type="button" class="pid-close" aria-label="Cerrar" (click)="ref.close()">✕</button>
      </div>

      @if (loading()) {
        <div class="pid-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (forbidden()) {
        <ui-empty title="No tiene permisos para ver esta pantalla." />
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las promociones."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (insights().length === 0) {
        <ui-empty title="Este comprobante no tiene promociones." />
      } @else {
        <div class="pid-list">
          @for (p of insights(); track p.promoId) {
            <div class="pid-promo">
              <div class="pid-promo-head">
                <span class="pid-promo-name">{{ p.promoName }}</span>
                @if (p.chargeAmount > 0) {
                  <span class="pid-charge">⚠ Desc. perdido {{ formatSoles(p.chargeAmount) }}</span>
                }
              </div>
              <p class="pid-muted">
                Se mide en {{ measureTypeName(p.measureType).toLowerCase() }} · Hoy:
                {{ measuredText(p) }} ·
                {{ p.currentTier != null ? 'Tramo ' + p.currentTier + ' alcanzado' : '' }}
                @if (p.currentTier == null) {
                  <span class="pid-no-tier">Sin tramo alcanzado</span>
                }
              </p>

              @for (t of p.tiers; track t.tier) {
                <div class="pid-tier">
                  <span>Tramo {{ t.tier }} · {{ t.thresholdText }}</span>
                  <span class="pid-tier-arrow">→</span>
                  <span>{{ benefitLabels(t.benefits) }}</span>
                  @if (p.currentTier === t.tier) {
                    <span class="pid-tier-current">✓ actual</span>
                  }
                </div>
              }

              <p class="pid-kept">
                Conserva:
                @if (p.currentlyGranted.length === 0 && p.currentDiscounts.length === 0) {
                  nada
                } @else {
                  @for (g of p.currentlyGranted; track g.productId) {
                    {{ quantityText(g.quantity) }} {{ g.productName }}
                    @if (g.originalProductName) {
                      <span class="pid-substitute">Sustituto de {{ g.originalProductName }}</span>
                    }
                  }
                  @for (d of p.currentDiscounts; track d.productId) {
                    Descuento {{ formatSoles(d.amount) }} en {{ d.productName }}
                  }
                }
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .pid {
        display: grid;
        gap: 14px;
      }
      .pid-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .pid-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .pid-subtitle {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pid-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--ink-muted);
        font-size: 16px;
        padding: 2px;
      }
      .pid-skeleton {
        height: 160px;
        background: var(--faint);
      }
      .pid-list {
        display: grid;
        gap: 16px;
        max-height: 60vh;
        overflow-y: auto;
      }
      .pid-promo {
        display: grid;
        gap: 6px;
        border-top: 1px dashed var(--hairline);
        padding-top: 14px;
      }
      .pid-promo:first-child {
        border-top: none;
        padding-top: 0;
      }
      .pid-promo-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .pid-promo-name {
        font-weight: 800;
        font-size: 15px;
        color: var(--ink);
      }
      .pid-charge {
        flex: none;
        font-size: 12px;
        font-weight: 700;
        color: var(--st-pendiente);
      }
      .pid-muted {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .pid-no-tier {
        color: var(--st-pendiente);
        font-weight: 700;
      }
      .pid-tier {
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 13px;
        color: var(--ink);
        flex-wrap: wrap;
      }
      .pid-tier-arrow {
        color: var(--ink-muted);
      }
      .pid-tier-current {
        color: var(--success);
        font-weight: 700;
        font-size: 12px;
      }
      .pid-kept {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ink);
      }
      .pid-substitute {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: 11px;
        font-weight: 700;
        color: var(--success);
        background: color-mix(in srgb, var(--success) 14%, transparent);
      }
    `,
  ],
})
export class PromoInsightsDialog {
  protected data = inject<PromoInsightsDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
  private deliverySvc = inject(DeliveryAdminService);

  protected formatSoles = formatSoles;
  protected quantityText = quantityText;
  protected measureTypeName = measureTypeName;

  protected insights = signal<PromoInsight[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected forbidden = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.forbidden.set(false);
    this.deliverySvc.promoInsights(this.data.invoiceId).subscribe({
      next: (list) => {
        this.insights.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 403) this.forbidden.set(true);
        else this.error.set(true);
      },
    });
  }

  protected measuredText(p: PromoInsight): string {
    return p.measureType === 'AMOUNT'
      ? formatSoles(p.currentMeasured)
      : quantityText(p.currentMeasured);
  }

  protected benefitLabels(benefits: BenefitInsight[]): string {
    return benefits.map((b) => b.label).join(' · ');
  }
}
