import { Component, input, output } from '@angular/core';

/**
 * Tarjeta tipo radio (ver DESIGN.md): una de varias opciones excluyentes,
 * mostradas como tarjetas en vez de radios nativos. El grupo lo arma el
 * llamador (varias `ui-option-card` con el mismo `name` conceptual); esta
 * pieza solo pinta una opción y emite su selección.
 */
@Component({
  selector: 'ui-option-card',
  template: `
    <button
      type="button"
      class="ui-option-card"
      [class.selected]="selected()"
      [attr.aria-pressed]="selected()"
      [disabled]="disabled()"
      (click)="pick.emit()"
    >
      <span class="ui-option-dot" aria-hidden="true"></span>
      <span class="ui-option-body">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styles: [
    `
      .ui-option-card {
        appearance: none;
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: left;
        font-family: var(--font-sans);
        font-size: 14px;
        min-height: var(--touch-min);
        padding: 10px 14px;
        border: 1.5px solid var(--divider);
        border-radius: var(--radius-control, 0);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
        transition:
          border-color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard);
      }
      .ui-option-card:hover:not(:disabled) {
        border-color: var(--ink-muted);
      }
      .ui-option-card:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ui-option-card:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .ui-option-dot {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid var(--divider);
        display: grid;
        place-items: center;
      }
      .ui-option-dot::after {
        content: '';
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent);
        transform: scale(0);
        transition: transform var(--dur-fast) var(--ease-standard);
      }
      .ui-option-card.selected {
        border-color: var(--accent);
        border-width: 2px;
        background: var(--accent-soft);
        font-weight: 700;
      }
      .ui-option-card.selected .ui-option-dot {
        border-color: var(--accent);
      }
      .ui-option-card.selected .ui-option-dot::after {
        transform: scale(1);
      }
    `,
  ],
})
export class UiOptionCard {
  selected = input(false);
  disabled = input(false);
  pick = output<void>();
}
