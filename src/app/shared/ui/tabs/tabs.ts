import { Component, input, model } from '@angular/core';

export interface UiTabItem {
  value: string;
  label: string;
}

/**
 * Barra de pestañas en memoria (sin ruta) — ver DESIGN.md. El contenido de
 * cada pestaña lo decide el llamador con un @switch sobre el mismo valor;
 * este componente solo pinta la barra y el valor activo.
 */
@Component({
  selector: 'ui-tabs',
  template: `
    <div class="ui-tabs" role="tablist">
      @for (item of items(); track item.value) {
        <button
          type="button"
          role="tab"
          class="ui-tab"
          [class.active]="value() === item.value"
          [attr.aria-selected]="value() === item.value"
          (click)="value.set(item.value)"
        >
          {{ item.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .ui-tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--hairline);
      }
      .ui-tab {
        appearance: none;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        padding: 10px 14px;
        min-height: var(--touch-min);
        border: 0;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .ui-tab:hover {
        color: var(--ink);
      }
      .ui-tab.active {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
    `,
  ],
})
export class UiTabs {
  items = input.required<UiTabItem[]>();
  value = model.required<string>();
}
