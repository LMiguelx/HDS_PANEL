import { Component, input, model } from '@angular/core';

let nextId = 0;

/**
 * Interruptor 56×30. La explicación va siempre al lado, nunca en tooltip.
 * Uso: <ui-toggle [(checked)]="combina" label="Se combina con otras promociones" />
 */
@Component({
  selector: 'ui-toggle',
  template: `
    <div class="ui-toggle-row">
      @if (label()) {
        <div class="ui-toggle-label">
          <span class="ui-toggle-title">{{ label() }}</span>
          <span class="ui-toggle-state">{{ checked() ? 'Activado' : 'Desactivado' }}</span>
        </div>
      }
      <button
        type="button"
        role="switch"
        [id]="id"
        class="ui-toggle-track"
        [class.on]="checked()"
        [attr.aria-checked]="checked()"
        [disabled]="disabled() || saving()"
        (click)="onToggle()"
      >
        <span class="ui-toggle-knob"></span>
      </button>
    </div>
    @if (hint()) {
      <div class="ui-toggle-hint">{{ hint() }}</div>
    }
  `,
  styles: [
    `
      .ui-toggle-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .ui-toggle-label {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ui-toggle-title {
        font-weight: 800;
        font-size: 16px;
        color: var(--ink);
      }
      .ui-toggle-state {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ui-toggle-track {
        appearance: none;
        width: 56px;
        height: 30px;
        min-height: 0;
        flex: none;
        border: 1px solid var(--ink-muted);
        background: var(--surface-sunk);
        border-radius: var(--radius-pill);
        cursor: pointer;
        position: relative;
        padding: 0;
        transition:
          background var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard);
      }
      .ui-toggle-track.on {
        background: var(--accent);
        border-color: var(--accent);
      }
      .ui-toggle-track:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ui-toggle-track:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .ui-toggle-knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: light-dark(#ffffff, #0f0e0d);
        box-shadow: 0 1px 3px light-dark(rgba(32, 30, 29, 0.35), rgba(0, 0, 0, 0.5));
        transition: transform var(--dur-fast) var(--ease-standard);
      }
      .ui-toggle-track.on .ui-toggle-knob {
        transform: translateX(26px);
      }
      .ui-toggle-hint {
        margin-top: 6px;
        font-size: 13px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class UiToggle {
  label = input('');
  disabled = input(false);
  saving = input(false);
  /** Explicación debajo del interruptor, a todo el ancho. */
  hint = input('');

  checked = model(false);

  protected id = `ui-toggle-${nextId++}`;

  protected onToggle() {
    this.checked.set(!this.checked());
  }
}
