import { Component, computed, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'block';
export type UiButtonSize = 'sm' | 'md';

/**
 * Botón del sistema nuevo (sin Material). Se aplica sobre un <button> real
 * para conservar semántica y accesibilidad nativas.
 * Uso: <button uiButton variant="primary">Guardar</button>
 */
@Component({
  selector: 'button[uiButton]',
  template: `
    @if (loading()) {
      <span class="ui-btn-spinner" aria-hidden="true"></span>
    }
    <ng-content></ng-content>
  `,
  host: {
    '[class]': 'hostClass()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[disabled]': 'disabled() || loading()',
  },
  styles: [
    `
      :host {
        appearance: none;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        border-radius: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: var(--touch-min);
        padding: 0 18px;
        border: 1px solid transparent;
        transition:
          background var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard),
          color var(--dur-fast) var(--ease-standard);
        white-space: nowrap;
      }
      :host(.ui-btn-sm) {
        min-height: 36px;
        padding: 0 14px;
        font-size: 13px;
      }
      :host(:focus-visible) {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      :host([disabled]) {
        opacity: 0.45;
        cursor: not-allowed;
      }

      :host(.ui-btn-primary) {
        background: var(--accent);
        color: var(--on-accent);
      }
      :host(.ui-btn-primary:hover:not([disabled])) {
        background: var(--accent-hover);
      }
      :host(.ui-btn-primary:active:not([disabled])) {
        background: var(--accent-press);
      }

      :host(.ui-btn-secondary) {
        background: transparent;
        color: var(--ink);
        border-color: var(--divider);
      }
      :host(.ui-btn-secondary:hover:not([disabled])) {
        background: var(--faint);
      }
      :host(.ui-btn-secondary:active:not([disabled])) {
        background: var(--hairline);
      }

      :host(.ui-btn-ghost) {
        background: transparent;
        color: var(--ink);
        border-color: transparent;
      }
      :host(.ui-btn-ghost:hover:not([disabled])) {
        background: var(--faint);
      }

      :host(.ui-btn-icon) {
        padding: 0;
        width: var(--touch-min);
        min-height: var(--touch-min);
        background: transparent;
        color: var(--ink);
        border-color: var(--divider);
      }
      :host(.ui-btn-icon:hover:not([disabled])) {
        background: var(--faint);
      }
      :host(.ui-btn-sm.ui-btn-icon) {
        width: 36px;
        min-height: 36px;
      }

      :host(.ui-btn-block) {
        width: 100%;
      }

      .ui-btn-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: ui-btn-spin 0.7s linear infinite;
        flex: none;
      }
      @keyframes ui-btn-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class UiButton {
  variant = input<UiButtonVariant>('secondary');
  size = input<UiButtonSize>('md');
  disabled = input(false);
  loading = input(false);

  protected hostClass = computed(() => {
    const classes = [`ui-btn-${this.variant()}`];
    if (this.size() === 'sm') classes.push('ui-btn-sm');
    return classes.join(' ');
  });
}
