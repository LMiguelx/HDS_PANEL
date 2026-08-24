import { Component, input, output } from '@angular/core';
import { UiButton } from '../button/button';

export type UiEmptyVariant = 'al-dia' | 'sin-resultados' | 'sin-permisos' | 'error';

/**
 * Estado vacío: siempre título + qué hacer + una acción. Alineado a la
 * izquierda, sin ilustración.
 */
@Component({
  selector: 'ui-empty',
  imports: [UiButton],
  template: `
    <div class="ui-empty">
      <div class="ui-empty-eyebrow">{{ eyebrow() }}</div>
      <h3 class="ui-empty-title">{{ title() }}</h3>
      <p class="ui-empty-body">{{ body() }}</p>
      @if (actionLabel()) {
        <button uiButton variant="secondary" (click)="action.emit()">{{ actionLabel() }}</button>
      }
    </div>
  `,
  styles: [
    `
      .ui-empty {
        border: 1px solid var(--hairline);
        padding: 48px 32px;
        text-align: left;
        max-width: 560px;
      }
      .ui-empty-eyebrow {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .ui-empty-title {
        font-size: 22px;
        margin: 6px 0 8px;
        color: var(--ink);
      }
      .ui-empty-body {
        font-size: 14px;
        color: var(--ink-muted);
        margin: 0 0 16px;
        line-height: 1.5;
      }
    `,
  ],
})
export class UiEmpty {
  variant = input<UiEmptyVariant>('al-dia');
  eyebrow = input('');
  title = input.required<string>();
  body = input('');
  actionLabel = input('');

  action = output<void>();
}
