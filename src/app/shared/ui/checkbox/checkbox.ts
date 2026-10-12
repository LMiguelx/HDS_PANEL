import { Component, input, model } from '@angular/core';

let nextId = 0;

/**
 * Casilla del sistema: un `input type="checkbox"` real por accesibilidad
 * (teclado y lectores de pantalla), con el estilo de `DESIGN.md` 11.2.
 * Toda la fila es clickeable porque el control vive dentro de un `<label>`
 * nativo — no hace falta un manejador de clic propio ni la trampa de
 * `ARCHITECTURE_PANEL.md` 8.9 (un handler que devuelve algo distinto de
 * `void` cancela el evento).
 * Uso: <ui-checkbox label="Conductor de reparto" [(checked)]="picked" hint="12" />
 */
@Component({
  selector: 'ui-checkbox',
  template: `
    <label class="ui-checkbox-row" [class.disabled]="disabled()" [for]="id">
      <input
        type="checkbox"
        [id]="id"
        class="ui-checkbox-input"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="onChange($event)"
      />
      <span class="ui-checkbox-label">{{ label() }}</span>
      @if (hint()) {
        <span class="ui-checkbox-hint">{{ hint() }}</span>
      }
    </label>
  `,
  styles: [
    `
      .ui-checkbox-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        min-height: var(--touch-min);
        cursor: pointer;
        font-size: var(--fs-dense);
        color: var(--ink);
      }
      .ui-checkbox-row.disabled {
        color: var(--ink-muted);
        cursor: not-allowed;
      }
      .ui-checkbox-input {
        width: 18px;
        height: 18px;
        flex: none;
        margin: 0;
        accent-color: var(--accent);
        cursor: pointer;
      }
      .ui-checkbox-input:disabled {
        cursor: not-allowed;
      }
      .ui-checkbox-input:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .ui-checkbox-label {
        flex: 1;
      }
      .ui-checkbox-hint {
        flex: none;
        color: var(--ink-muted);
        font-size: var(--fs-meta);
      }
    `,
  ],
})
export class UiCheckbox {
  label = input.required<string>();
  disabled = input(false);
  /** Texto o contador a la derecha (p. ej. cuántas personas tienen el rol). */
  hint = input('');

  checked = model(false);

  protected id = `ui-checkbox-${nextId++}`;

  protected onChange(ev: Event) {
    this.checked.set((ev.target as HTMLInputElement).checked);
  }
}
