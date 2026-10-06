import { Component, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

/**
 * Chrome común para los diálogos "grandes" (formularios), a diferencia de
 * `ui-confirm-dialog` que es para confirmaciones cortas. Cabecera y pie
 * fijos, solo el cuerpo (contenido proyectado) hace scroll — así un
 * formulario largo nunca se corta sin forma de llegar al botón de acción.
 * Cierra con Esc vía `UiDialogService` (backdrop/keydown); el botón X de
 * aquí es una vía adicional.
 */
@Component({
  selector: 'ui-modal',
  imports: [CdkTrapFocus],
  template: `
    <div class="ui-modal" cdkTrapFocus cdkTrapFocusAutoCapture="true">
      <header class="ui-modal-header">
        <div class="ui-modal-heading">
          <h2 class="ui-modal-title">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="ui-modal-subtitle">{{ subtitle() }}</p>
          }
        </div>
        <button type="button" class="ui-modal-close" aria-label="Cerrar" (click)="close.emit()">
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </header>

      <div class="ui-modal-body">
        <ng-content></ng-content>
      </div>

      <footer class="ui-modal-footer">
        <ng-content select="[modalFooter]"></ng-content>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .ui-modal {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        background: var(--bg);
        border: 2px solid var(--divider);
        box-shadow: var(--elev-dialog);
      }
      .ui-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: var(--border-hair);
        flex: none;
      }
      .ui-modal-heading {
        min-width: 0;
      }
      .ui-modal-title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        color: var(--ink);
      }
      .ui-modal-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ui-modal-close {
        flex: none;
        appearance: none;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: none;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .ui-modal-close:hover {
        color: var(--ink);
        background: var(--faint);
      }
      .ui-modal-close .material-icons {
        font-size: 20px;
      }
      .ui-modal-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .ui-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 24px;
        border-top: var(--border-hair);
        flex: none;
      }
      .ui-modal-footer:empty {
        display: none;
      }

      @media (max-width: 599px) {
        .ui-modal {
          max-width: 100%;
        }
      }
    `,
  ],
})
export class UiModal {
  title = input.required<string>();
  subtitle = input('');
  close = output<void>();
}
