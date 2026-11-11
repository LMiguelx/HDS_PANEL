import { Component, input, output } from '@angular/core';

/**
 * Bandeja de aprobación: listado a la izquierda, detalle a la derecha, pie
 * fijo dentro del detalle (doc 39, sección 4.2). Solo arma el layout — cada
 * pantalla que la use decide el contenido de cada columna por projection.
 * Bajo ~1100px el listado y el detalle ocupan todo el ancho, uno a la vez,
 * con el enlace "Volver al listado".
 */
@Component({
  selector: 'ui-approval-tray',
  template: `
    <div class="ui-tray" [class.ui-tray-detail-open]="detailOpen()">
      <div class="ui-tray-list">
        <ng-content select="[trayFilter]"></ng-content>
        <div class="ui-tray-list-body">
          <ng-content select="[trayList]"></ng-content>
        </div>
      </div>
      <div class="ui-tray-detail">
        @if (detailOpen()) {
          <button type="button" class="ui-tray-back" (click)="back.emit()">
            <span class="material-icons" aria-hidden="true">arrow_back</span>
            Volver al listado
          </button>
        }
        <div class="ui-tray-detail-body">
          <ng-content select="[trayDetail]"></ng-content>
        </div>
        <div class="ui-tray-detail-footer">
          <ng-content select="[trayFooter]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ui-tray {
        display: grid;
        grid-template-columns: minmax(280px, 0.68fr) 1fr;
        gap: var(--sp-6);
        align-items: start;
        min-height: 0;
      }
      .ui-tray-list {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--hairline);
        background: var(--surface);
        border-radius: var(--radius-card);
        overflow: hidden;
      }
      .ui-tray-list-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        max-height: 70vh;
      }
      .ui-tray-detail {
        display: flex;
        flex-direction: column;
        min-height: 0;
        max-height: 70vh;
        border: 1px solid var(--hairline);
        background: var(--surface);
        border-radius: var(--radius-card);
        overflow: hidden;
      }
      .ui-tray-back {
        display: none;
        align-items: center;
        gap: var(--sp-2);
        appearance: none;
        border: 0;
        border-bottom: 1px solid var(--hairline);
        background: transparent;
        font-family: var(--font-sans);
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--accent-ink);
        padding: var(--sp-3) var(--sp-5);
        cursor: pointer;
        flex: none;
      }
      .ui-tray-back .material-icons {
        font-size: 18px;
      }
      .ui-tray-detail-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: var(--sp-6);
      }
      .ui-tray-detail-footer {
        flex: none;
        border-top: 1px solid var(--hairline);
        padding: var(--sp-4) var(--sp-6);
      }

      @media (max-width: 1100px) {
        .ui-tray {
          grid-template-columns: 1fr;
        }
        .ui-tray-list,
        .ui-tray-detail {
          max-height: none;
        }
        .ui-tray.ui-tray-detail-open .ui-tray-list {
          display: none;
        }
        .ui-tray:not(.ui-tray-detail-open) .ui-tray-detail {
          display: none;
        }
        .ui-tray-back {
          display: flex;
        }
      }
    `,
  ],
})
export class UiApprovalTray {
  /** true cuando hay una fila seleccionada (en móvil, muestra el detalle en vez del listado). */
  detailOpen = input(false);

  back = output<void>();
}
