import { Component, input } from '@angular/core';
import { UiBadge } from '../../../shared/ui/badge/badge';
import { TierView } from '../promo.types';
import { benefitProductName, benefitQuantityText, thresholdText } from '../domain/promo-texts';

interface TierRow {
  entrega: string;
  entregaTone: 'success' | 'neutral';
  groupLabel: string | null;
  benefitTypeName: string;
  productCode: string;
  premio: string;
  cantidad: string;
}

/**
 * "Tramos y premios" — doc 45, sección 1 y 2.4: un bloque por tramo, una
 * sola tabla por tramo aunque haya varios grupos de premios (nunca cabeceras
 * repetidas por grupo).
 */
@Component({
  selector: 'app-promo-tiers-table',
  imports: [UiBadge],
  template: `
    <div class="ptt-tiers">
      @for (tier of tiers(); track tier.tier) {
        <div class="ptt-tier">
          <div class="ptt-tier-head">
            <span class="ptt-tier-pill">Tramo {{ tier.tier }}</span>
            <span class="ptt-tier-threshold">{{ tierThreshold(tier) }}</span>
            <span class="ptt-tier-summary">{{ tierSummary(tier) }}</span>
          </div>
          <table class="ui-table-grid ptt-table">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Tipo</th>
                <th>Código</th>
                <th>Premio</th>
                <th class="ptt-col-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              @for (row of tierRows(tier); track $index) {
                <tr>
                  <td>
                    <ui-badge [tone]="row.entregaTone">{{ row.entrega }}</ui-badge>
                  </td>
                  <td class="ptt-muted">{{ row.benefitTypeName }}</td>
                  <td class="ptt-muted">{{ row.productCode }}</td>
                  <td>
                    @if (row.groupLabel) {
                      <div class="ptt-group-label">{{ row.groupLabel }}</div>
                    }
                    {{ row.premio }}
                  </td>
                  <td class="ptt-col-right ptt-strong">{{ row.cantidad }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ptt-tiers {
        display: grid;
        gap: var(--sp-5);
      }
      .ptt-tier {
        border: 1px solid var(--hairline);
        border-radius: var(--radius-card);
        overflow: hidden;
      }
      .ptt-tier-head {
        display: flex;
        align-items: baseline;
        gap: var(--sp-3);
        padding: var(--sp-3) var(--sp-4);
        background: var(--surface-sunk);
        border-bottom: 1px solid var(--hairline);
      }
      .ptt-tier-pill {
        border: 1.5px solid var(--accent-ink);
        color: var(--accent-ink);
        border-radius: var(--radius-pill);
        padding: 2px 10px;
        font-size: var(--fs-meta);
        font-weight: 700;
        flex: none;
      }
      .ptt-tier-threshold {
        font-size: var(--fs-h2);
        font-weight: var(--fw-h2);
        color: var(--ink);
      }
      .ptt-tier-summary {
        margin-left: auto;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .ptt-table {
        width: 100%;
      }
      .ptt-muted {
        color: var(--ink-muted);
      }
      .ptt-strong {
        font-weight: 700;
      }
      .ptt-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .ptt-group-label {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .ptt-tier-head {
          flex-wrap: wrap;
        }
        .ptt-tier-summary {
          margin-left: 0;
          flex: 1 0 100%;
        }
      }
    `,
  ],
})
export class PromoTiersTable {
  tiers = input<TierView[] | null | undefined>(null);
  measureType = input<string | null | undefined>(null);
  promoType = input<string | null | undefined>(null);

  protected tierThreshold(tier: TierView): string {
    return thresholdText({
      promoType: this.promoType(),
      measureType: this.measureType(),
      fromQuantity: tier.fromQuantity,
      fromAmount: tier.fromAmount,
    });
  }

  protected tierSummary(tier: TierView): string {
    const groups = tier.benefitGroups ?? [];
    const total = groups.reduce((n, g) => n + (g.benefits?.length ?? 0), 0);
    const allGroup = groups.find((g) => g.selectionMode === 'ALL' && (g.benefits?.length ?? 0) > 0);
    const chooseGroup = groups.find(
      (g) => g.selectionMode === 'CHOOSE' && (g.benefits?.length ?? 0) > 0,
    );
    let modeText = 'se entregan todos';
    if (chooseGroup && allGroup) modeText = 'combinado';
    else if (chooseGroup)
      modeText = `elige ${chooseGroup.chooseCount ?? 1} de ${chooseGroup.benefits?.length ?? 0}`;
    return `${total} premio${total === 1 ? '' : 's'} · ${modeText}`;
  }

  protected tierRows(tier: TierView): TierRow[] {
    const rows: TierRow[] = [];
    for (const group of tier.benefitGroups ?? []) {
      const benefits = group.benefits ?? [];
      benefits.forEach((b, i) => {
        rows.push({
          entrega:
            group.selectionMode === 'CHOOSE'
              ? `Elige ${group.chooseCount ?? 1} de ${benefits.length}`
              : 'Siempre',
          entregaTone: group.selectionMode === 'CHOOSE' ? 'neutral' : 'success',
          groupLabel: i === 0 ? (group.label ?? null) : null,
          benefitTypeName: b.benefitTypeName ?? '',
          productCode: b.productCode ?? '—',
          premio: benefitProductName(b),
          cantidad: benefitQuantityText(b),
        });
      });
    }
    return rows;
  }
}
