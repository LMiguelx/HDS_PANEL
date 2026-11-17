import { Component, input } from '@angular/core';

/**
 * Ícono ⓘ con tooltip nativo (`title`), para explicar qué mide un KPI o
 * columna y qué acción se espera, sin ocupar espacio permanente en pantalla.
 * Uso: <span uiInfoTip text="Qué mide esto y qué hacer"></span>
 */
@Component({
  selector: 'span[uiInfoTip]',
  template: `ⓘ`,
  host: {
    class: 'ui-info-tip',
    role: 'img',
    '[attr.aria-label]': 'text()',
    '[attr.title]': 'text()',
    tabindex: '0',
  },
  styles: [
    `
      .ui-info-tip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        font-size: 12px;
        line-height: 1;
        color: var(--ink-muted);
        cursor: help;
        flex: none;
      }
      .ui-info-tip:hover,
      .ui-info-tip:focus-visible {
        color: var(--accent-ink);
        outline: none;
      }
    `,
  ],
})
export class UiInfoTip {
  text = input.required<string>({ alias: 'uiInfoTip' });
}
