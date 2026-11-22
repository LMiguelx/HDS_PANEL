import { Component, input } from '@angular/core';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { PickingDayView } from '../domain/logistics.models';
import { quantityText } from '../../sales-reports/sales-report-format';

/** Tarjeta 2 de "Picking y reparto" — doc 93, sección 2.6. */
@Component({
  selector: 'app-logistics-shortfall-card',
  imports: [UiEmpty],
  template: `
    <div class="lsf-card">
      <div class="lsf-head">
        <h3>Faltantes de carga</h3>
        @if (picking().withShortfall > 0) {
          <span class="lsf-badge">{{ picking().withShortfall }} planillas</span>
        }
      </div>
      @if (picking().withShortfall === 0) {
        <ui-empty variant="al-dia" title="Sin faltantes de carga hoy ✔" />
      } @else {
        <ul class="lsf-list">
          @for (p of picking().topShortProducts; track p.productCode) {
            <li class="lsf-row">
              <div class="lsf-row-main">
                <span class="lsf-code">{{ p.productCode }}</span>
                <span class="lsf-name" [title]="p.productName">{{ p.productName }}</span>
              </div>
              <span class="lsf-qty">
                −{{ quantityText(p.shortQuantity) }} {{ p.unitOfMeasure }}
              </span>
              <div class="lsf-meta">
                <span>en {{ p.batchCount }} planilla{{ p.batchCount === 1 ? '' : 's' }}</span>
                @if (p.lastNote) {
                  <span class="lsf-note" [title]="p.lastNote">{{ p.lastNote }}</span>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .lsf-card {
        border: 1px solid var(--hairline);
        background: var(--surface);
        padding: 14px 16px;
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .lsf-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      h3 {
        margin: 0;
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .lsf-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--status-warn);
        white-space: nowrap;
      }
      .lsf-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }
      .lsf-row {
        display: grid;
        gap: 2px;
      }
      .lsf-row-main {
        display: flex;
        gap: 6px;
        min-width: 0;
      }
      .lsf-code {
        font-size: 11px;
        color: var(--ink-muted);
        flex: none;
      }
      .lsf-name {
        font-size: 13px;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lsf-qty {
        font-size: 13px;
        font-weight: 800;
        color: var(--status-danger);
        font-variant-numeric: var(--tnum);
      }
      .lsf-meta {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--ink-muted);
        min-width: 0;
      }
      .lsf-note {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
    `,
  ],
})
export class LogisticsShortfallCard {
  picking = input.required<PickingDayView>();
  protected quantityText = quantityText;
}
