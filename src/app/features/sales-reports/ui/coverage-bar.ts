import { Component, input } from '@angular/core';
import {
  STOCK_LEVEL_COLOR_VAR,
  StockLevel,
  coveragePct,
} from '../domain/purchase-suggestion.format';

/** Mini barra de cobertura — doc 94, sección 7: fina, redondeada, del color del nivel, sin texto dentro. */
@Component({
  selector: 'app-coverage-bar',
  template: `
    <div class="cvb-track">
      <div
        class="cvb-fill"
        [style.width.%]="coveragePct(coverageDays(), targetDays())"
        [style.background]="'var(' + STOCK_LEVEL_COLOR_VAR[level()] + ')'"
      ></div>
    </div>
  `,
  styles: [
    `
      .cvb-track {
        height: 5px;
        border-radius: var(--radius-pill);
        background: var(--faint);
        overflow: hidden;
      }
      .cvb-fill {
        height: 100%;
        border-radius: var(--radius-pill);
      }
    `,
  ],
})
export class CoverageBar {
  coverageDays = input<number | null>(null);
  targetDays = input.required<number>();
  level = input.required<StockLevel>();

  protected coveragePct = coveragePct;
  protected STOCK_LEVEL_COLOR_VAR = STOCK_LEVEL_COLOR_VAR;
}
