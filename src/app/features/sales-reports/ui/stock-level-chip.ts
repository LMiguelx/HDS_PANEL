import { Component, computed, input } from '@angular/core';
import {
  STOCK_LEVEL_COLOR_VAR,
  STOCK_LEVEL_LABEL,
  StockLevel,
} from '../domain/purchase-suggestion.format';

/**
 * Etiqueta de nivel — doc 94, sección 4: el color siempre acompaña al
 * texto, nunca lo reemplaza. `dense` quita el punto para usarla pegada al
 * nombre del producto en la fila de la tabla.
 */
@Component({
  selector: 'app-stock-level-chip',
  template: `
    <span class="slc" [style.color]="colorVar()">
      @if (!dense()) {
        <span class="slc-dot" [style.background]="colorVar()"></span>
      }
      {{ label() }}
    </span>
  `,
  styles: [
    `
      .slc {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 700;
        white-space: nowrap;
      }
      .slc-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
      }
    `,
  ],
})
export class StockLevelChip {
  level = input.required<StockLevel>();
  dense = input(false);

  protected colorVar = computed(() => `var(${STOCK_LEVEL_COLOR_VAR[this.level()]})`);
  protected label = computed(() => STOCK_LEVEL_LABEL[this.level()]);
}
