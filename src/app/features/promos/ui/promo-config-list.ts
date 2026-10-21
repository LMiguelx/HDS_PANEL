import { Component, input } from '@angular/core';

export interface PromoConfigRow {
  label: string;
  value: string;
  strong?: boolean;
}

/**
 * Filas etiqueta–valor — doc 45, sección 1. Sigue el patrón `od-summary-row`
 * (sección 14.2 de DESIGN.md: todavía no es un componente de `shared/ui`).
 */
@Component({
  selector: 'app-promo-config-list',
  template: `
    <div class="pcl">
      @for (row of rows(); track row.label) {
        <div class="pcl-row" [class.pcl-row-strong]="row.strong">
          <span>{{ row.label }}</span>
          <span>{{ row.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .pcl {
        display: grid;
        gap: var(--sp-2);
      }
      .pcl-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--sp-3);
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .pcl-row span:last-child {
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .pcl-row-strong {
        padding-top: var(--sp-2);
        border-top: 1px solid var(--hairline);
        font-weight: 700;
      }
      .pcl-row-strong span:last-child {
        font-size: var(--fs-body);
      }
    `,
  ],
})
export class PromoConfigList {
  rows = input.required<PromoConfigRow[]>();
}
