import { Component, input } from '@angular/core';

export type UiBadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

/**
 * Etiqueta pequeña redondeada (ver DESIGN.md) para conteos y estados
 * cortos — p. ej. el número de líneas del carrito.
 */
@Component({
  selector: 'ui-badge',
  template: `<span class="ui-badge" [class]="'ui-badge-' + tone()"
    ><ng-content></ng-content
  ></span>`,
  styles: [
    `
      .ui-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 7px;
        border-radius: var(--radius-pill);
        font-size: 12px;
        font-weight: 700;
        font-variant-numeric: var(--tnum);
        line-height: 1;
      }
      .ui-badge-neutral {
        background: var(--faint);
        color: var(--ink-muted);
      }
      .ui-badge-accent {
        background: var(--accent);
        color: var(--on-accent);
      }
      .ui-badge-success {
        background: var(--success);
        color: var(--on-accent);
      }
      .ui-badge-warning {
        background: var(--accent-soft);
        color: var(--accent-ink);
      }
    `,
  ],
})
export class UiBadge {
  tone = input<UiBadgeTone>('neutral');
}
