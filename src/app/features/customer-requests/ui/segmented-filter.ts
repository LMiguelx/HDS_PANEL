import { Component, input, model } from '@angular/core';

export type ErpFilterValue = 'all' | 'ready' | 'waiting';

export interface ErpFilterCounts {
  all: number;
  ready: number;
  waiting: number;
}

/**
 * Filtro segmentado "Todas · Listas para aprobar · Esperando ERP" de cada
 * pestaña de Aprobaciones — doc 39, sección 4.2. Filtra sobre lo ya
 * cargado: no dispara otra petición.
 */
@Component({
  selector: 'app-erp-segmented-filter',
  template: `
    <div class="seg-filter" role="tablist">
      <button
        type="button"
        class="seg-btn"
        [class.active]="value() === 'all'"
        (click)="value.set('all')"
      >
        Todas <span class="seg-count">{{ counts().all }}</span>
      </button>
      <button
        type="button"
        class="seg-btn"
        [class.active]="value() === 'ready'"
        (click)="value.set('ready')"
      >
        Listas <span class="seg-count">{{ counts().ready }}</span>
      </button>
      <button
        type="button"
        class="seg-btn"
        [class.active]="value() === 'waiting'"
        (click)="value.set('waiting')"
      >
        Esperando ERP <span class="seg-count">{{ counts().waiting }}</span>
      </button>
    </div>
  `,
  styles: [
    `
      .seg-filter {
        display: flex;
        gap: 2px;
        overflow-x: auto;
        padding: var(--sp-3) var(--sp-3) 0;
      }
      .seg-btn {
        appearance: none;
        border: 0;
        background: transparent;
        font-family: var(--font-sans);
        font-size: var(--fs-meta);
        font-weight: 700;
        color: var(--ink-muted);
        white-space: nowrap;
        padding: var(--sp-2) var(--sp-3);
        border-radius: var(--radius-pill);
        cursor: pointer;
      }
      .seg-btn:hover {
        background: var(--faint);
      }
      .seg-btn.active {
        background: var(--accent-wash);
        color: var(--accent-ink);
      }
      .seg-count {
        font-variant-numeric: var(--tnum);
      }
    `,
  ],
})
export class ErpSegmentedFilter {
  counts = input.required<ErpFilterCounts>();
  value = model<ErpFilterValue>('all');
}
