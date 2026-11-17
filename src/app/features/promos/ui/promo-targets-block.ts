import { Component, input } from '@angular/core';
import { UiStatus } from '../../../shared/ui/status/status';
import { quantityText } from '../../sales-reports/sales-report-format';
import { SegmentTargetView, CustomerTargetView } from '../promo.types';

/** "A quiénes llega" — doc 45, sección 1. Reusado por detalle y paso 5. */
@Component({
  selector: 'app-promo-targets-block',
  imports: [UiStatus],
  template: `
    @if (!segments()?.length && !customers()?.length) {
      <p class="ptb-empty">
        Todos los clientes{{ salesChannelName() ? ' del canal ' + salesChannelName() : '' }}.
      </p>
    } @else {
      @if (segments()?.length) {
        <table class="ui-table-grid ptb-table">
          <thead>
            <tr>
              <th>Segmento</th>
              <th class="ptb-col-right">Clientes</th>
              <th>Modo</th>
            </tr>
          </thead>
          <tbody>
            @for (s of segments(); track s.segmentId) {
              <tr>
                <td>{{ s.segmentName }}</td>
                <td class="ptb-col-right ptb-muted">{{ s.customerCount ?? 0 }}</td>
                <td><ui-status [label]="s.mode === 'INCLUDE' ? 'Incluido' : 'Excluido'" /></td>
              </tr>
            }
          </tbody>
        </table>
      }
      @if (customers()?.length) {
        <table class="ui-table-grid ptb-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Modo</th>
              <th class="ptb-col-right">Tope</th>
            </tr>
          </thead>
          <tbody>
            @for (c of customers(); track c.customerId) {
              <tr>
                <td class="ptb-muted">{{ c.customerCode }}</td>
                <td>{{ c.customerName }}</td>
                <td><ui-status [label]="c.mode === 'INCLUDE' ? 'Incluido' : 'Excluido'" /></td>
                <td class="ptb-col-right ptb-muted">
                  {{ c.maxQuantity != null ? quantityText(c.maxQuantity) : '—' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: [
    `
      .ptb-empty {
        margin: 0;
        font-size: var(--fs-body);
        color: var(--ink-muted);
      }
      .ptb-table {
        width: 100%;
        margin-bottom: var(--sp-3);
      }
      .ptb-table:last-child {
        margin-bottom: 0;
      }
      .ptb-muted {
        color: var(--ink-muted);
      }
      .ptb-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
    `,
  ],
})
export class PromoTargetsBlock {
  segments = input<SegmentTargetView[] | null | undefined>(null);
  customers = input<CustomerTargetView[] | null | undefined>(null);
  salesChannelName = input<string | null | undefined>(null);

  protected quantityText = quantityText;
}
