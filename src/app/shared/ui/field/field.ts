import { Component, model, input } from '@angular/core';

export type UiFieldType = 'text' | 'number' | 'date' | 'password' | 'textarea' | 'select';

export interface UiFieldOption {
  value: string;
  label: string;
}

let nextId = 0;

/**
 * Campo de formulario del sistema nuevo: texto, número, fecha, área o select
 * nativo, con etiqueta y texto de ayuda. Enlace de dos vías con `[(value)]`.
 */
@Component({
  selector: 'ui-field',
  template: `
    <div class="ui-field" [class.ui-field-error]="!!error()">
      <label [for]="id">{{ label() }}</label>

      @switch (type()) {
        @case ('textarea') {
          <textarea
            [id]="id"
            class="ui-input"
            [rows]="rows()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [readOnly]="readonly()"
            [attr.aria-invalid]="!!error()"
            [attr.aria-describedby]="hint() || error() ? id + '-hint' : null"
            [value]="value()"
            (input)="onInput($event)"
          ></textarea>
        }
        @case ('select') {
          <select
            [id]="id"
            class="ui-input"
            [disabled]="disabled()"
            [attr.aria-invalid]="!!error()"
            [attr.aria-describedby]="hint() || error() ? id + '-hint' : null"
            [value]="value()"
            (change)="onInput($event)"
          >
            <!-- [selected] mantiene lo mostrado en sintonía con el modelo:
                 sin esto el navegador pinta la primera opción aunque el
                 valor esté vacío, y el formulario parece lleno sin estarlo. -->
            @for (opt of options(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === value()">
                {{ opt.label }}
              </option>
            }
          </select>
        }
        @default {
          <div class="ui-field-input-wrap">
            @if (icon()) {
              <span class="material-icons ui-field-icon" aria-hidden="true">{{ icon() }}</span>
            }
            <input
              [id]="id"
              class="ui-input"
              [class.ui-input-icon]="!!icon()"
              [class.ui-input-suffix]="hasSuffix()"
              [type]="type()"
              [placeholder]="placeholder()"
              [disabled]="disabled()"
              [readOnly]="readonly()"
              [attr.aria-invalid]="!!error()"
              [attr.aria-describedby]="hint() || error() ? id + '-hint' : null"
              [value]="value()"
              (input)="onInput($event)"
            />
            <ng-content select="[fieldSuffix]"></ng-content>
          </div>
        }
      }

      @if (error()) {
        <div class="ui-field-hint ui-field-error-text" [id]="id + '-hint'">{{ error() }}</div>
      } @else if (hint()) {
        <div class="ui-field-hint" [id]="id + '-hint'">{{ hint() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .ui-field {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .ui-field-input-wrap {
        position: relative;
      }
      .ui-field-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 20px;
        color: var(--ink-muted);
        pointer-events: none;
      }
      .ui-input {
        font-family: var(--font-sans);
        font-size: 15px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        border-radius: 0;
        min-height: var(--touch-min);
        padding: 0 12px;
        width: 100%;
        box-sizing: border-box;
      }
      .ui-input-icon {
        padding-left: 40px;
      }
      .ui-input-suffix {
        padding-right: 40px;
      }
      textarea.ui-input {
        padding: 10px 12px;
        min-height: 84px;
        resize: vertical;
        font-family: inherit;
      }
      .ui-input:hover:not(:disabled) {
        border-color: var(--ink-muted);
      }
      .ui-input:focus-visible {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 1px var(--accent);
      }
      .ui-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .ui-input:read-only {
        background: transparent;
      }
      /* El popup nativo del <select> no siempre hereda color-scheme del
         documento (varía por navegador); sin esto el texto queda claro
         sobre fondo claro del sistema al usar el tema oscuro de la app. */
      select.ui-input option {
        background-color: var(--surface-sunk);
        color: var(--ink);
      }
      .ui-field-error .ui-input {
        border-color: var(--st-vencida, #d13b3b);
      }
      .ui-field-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .ui-field-error-text {
        color: var(--accent-ink);
      }
    `,
  ],
})
export class UiField {
  label = input.required<string>();
  type = input<UiFieldType>('text');
  placeholder = input('');
  hint = input('');
  error = input('');
  disabled = input(false);
  readonly = input(false);
  rows = input(3);
  options = input<UiFieldOption[]>([]);
  /** Ícono (ligadura de Material Icons) a la izquierda del input. Opcional. */
  icon = input('');
  /** Reserva espacio a la derecha para contenido proyectado con `fieldSuffix` (p. ej. el botón de mostrar/ocultar contraseña). */
  hasSuffix = input(false);

  value = model<string>('');

  protected id = `ui-field-${nextId++}`;

  protected onInput(ev: Event) {
    const target = ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this.value.set(target.value);
  }
}
