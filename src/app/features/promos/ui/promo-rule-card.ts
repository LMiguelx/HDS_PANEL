import { Component, computed, input } from '@angular/core';
import { ConditionView, TierView } from '../promo.types';
import { conditionsSummaryText, thresholdText } from '../domain/promo-texts';
import { quantityText } from '../../sales-reports/sales-report-format';
import { formatSoles } from '../../../shared/pipes/money';

/** Forma mínima que necesita esta pieza — doc 45, sección 1: detalle o asistente, lo que sea. */
export interface PromoRuleCardSource {
  promoType?: string | null;
  measureType?: string | null;
  conditions?: ConditionView[] | null;
  tiers?: TierView[] | null;
  salesChannelName?: string | null;
  maxApplicationsPerCustomer?: number | null;
  segments?:
    { segmentName?: string | null; mode?: string | null; customerCount?: number | null }[] | null;
  customers?: { customerName?: string | null; mode?: string | null }[] | null;
}

/**
 * "La regla": Si compra → Recibe → Para, en tres bloques — doc 45,
 * sección 2.3.1. Siempre el PRIMER tramo; si hay más, "+N tramos más".
 */
@Component({
  selector: 'app-promo-rule-card',
  template: `
    <div class="prc">
      <div class="prc-block">
        <span class="prc-eyebrow">Si compra</span>
        <div class="prc-threshold">{{ thresholdText() }}</div>
        @if (scopeText()) {
          <div class="prc-sub">{{ scopeText() }}</div>
        }
      </div>
      <span class="material-icons prc-arrow" aria-hidden="true">arrow_forward</span>
      <div class="prc-block prc-receive">
        <span class="prc-eyebrow">{{ receiveModeText() }}</span>
        @for (line of receiveLines(); track $index) {
          <div class="prc-benefit">{{ line }}</div>
        }
        @if (extraTiersCount() > 0) {
          <div class="prc-more">
            +{{ extraTiersCount() }} tramo{{ extraTiersCount() === 1 ? '' : 's' }} más
          </div>
        }
      </div>
      <span class="material-icons prc-arrow" aria-hidden="true">arrow_forward</span>
      <div class="prc-block">
        <span class="prc-eyebrow">Para</span>
        <div class="prc-threshold prc-para-title">{{ audienceTitle() }}</div>
        @if (audienceSub()) {
          <div class="prc-sub">{{ audienceSub() }}</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .prc {
        display: flex;
        align-items: stretch;
        gap: var(--sp-5);
      }
      .prc-block {
        flex: 1;
        min-width: 0;
        display: grid;
        align-content: start;
        gap: 4px;
      }
      .prc-receive {
        background: var(--accent-wash);
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--radius-control);
      }
      .prc-eyebrow {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        font-weight: 700;
        color: var(--ink-muted);
      }
      .prc-threshold {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
        line-height: 1.2;
      }
      .prc-para-title {
        font-size: var(--fs-body);
        font-weight: 700;
      }
      .prc-sub {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .prc-benefit {
        font-size: var(--fs-body);
        font-weight: 700;
        color: var(--ink);
        line-height: 1.35;
      }
      .prc-more {
        margin-top: 2px;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .prc-arrow {
        align-self: center;
        color: var(--ink-muted);
        font-size: 20px;
      }

      @media (max-width: 767px) {
        .prc {
          flex-direction: column;
        }
        .prc-arrow {
          transform: rotate(90deg);
          align-self: flex-start;
          margin-left: 4px;
        }
      }
    `,
  ],
})
export class PromoRuleCard {
  source = input.required<PromoRuleCardSource>();

  protected firstTier = computed(() => this.source().tiers?.[0] ?? null);
  protected extraTiersCount = computed(() => Math.max(0, (this.source().tiers?.length ?? 0) - 1));

  protected thresholdText(): string {
    const s = this.source();
    return thresholdText({
      promoType: s.promoType,
      measureType: s.measureType,
      fromQuantity: this.firstTier()?.fromQuantity,
      fromAmount: this.firstTier()?.fromAmount,
    });
  }

  protected scopeText(): string {
    const conditions = this.source().conditions ?? [];
    if (this.source().promoType === 'CUSTOMER_LIST' || conditions.length === 0) return '';
    if (conditions.length === 1) return conditionsSummaryText(conditions);
    return `entre ${conditions.length} productos · se suman entre sí`;
  }

  protected receiveModeText(): string {
    const groups = this.firstTier()?.benefitGroups ?? [];
    const allGroup = groups.find((g) => g.selectionMode === 'ALL' && (g.benefits?.length ?? 0) > 0);
    const chooseGroup = groups.find(
      (g) => g.selectionMode === 'CHOOSE' && (g.benefits?.length ?? 0) > 0,
    );
    if (allGroup && chooseGroup) return 'Recibe';
    if (chooseGroup)
      return `Elige ${chooseGroup.chooseCount ?? 1} de ${chooseGroup.benefits?.length ?? 0}`;
    return 'Recibe gratis · se entregan todos';
  }

  protected receiveLines(): string[] {
    const groups = this.firstTier()?.benefitGroups ?? [];
    const benefits = groups.flatMap((g) => g.benefits ?? []);
    return benefits.map((b) => {
      if (b.benefitType === 'DISCOUNT_AMOUNT')
        return `${formatSoles(b.discountAmount ?? 0)} de descuento`;
      if (b.benefitType === 'DISCOUNT_PERCENT') return `${b.discountPercent ?? 0}% de descuento`;
      const name = b.productName ?? b.label ?? 'Premio sin nombre';
      return `${quantityText(b.quantity ?? 1)} × ${name}`;
    });
  }

  protected audienceTitle(): string {
    const s = this.source();
    if ((s.segments?.length ?? 0) === 0 && (s.customers?.length ?? 0) === 0)
      return 'Todos los clientes';
    const totalCustomers = (s.segments ?? []).reduce(
      (acc, seg) => acc + (seg.customerCount ?? 0),
      0,
    );
    return totalCustomers > 0 ? `${totalCustomers} clientes` : 'Alcance limitado';
  }

  protected audienceSub(): string {
    const s = this.source();
    const noLimit = s.maxApplicationsPerCustomer == null;
    const limitText = noLimit
      ? 'sin límite por cliente'
      : `máximo ${s.maxApplicationsPerCustomer} veces por cliente`;
    if ((s.segments?.length ?? 0) === 0 && (s.customers?.length ?? 0) === 0) {
      return s.salesChannelName ? `del canal ${s.salesChannelName} · ${limitText}` : limitText;
    }
    const segmentNames = (s.segments ?? [])
      .filter((x) => x.mode === 'INCLUDE')
      .map((x) => x.segmentName);
    const customerNames = (s.customers ?? [])
      .filter((x) => x.mode === 'INCLUDE')
      .map((x) => x.customerName);
    const parts = [...segmentNames, ...customerNames].filter(Boolean);
    return parts.length ? parts.join(', ') : limitText;
  }
}
