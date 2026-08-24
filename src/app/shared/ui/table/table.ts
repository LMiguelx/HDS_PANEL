import { Component, input, output } from '@angular/core';
import { UiButton } from '../button/button';

/**
 * Envoltorio de estado para tablas densas: cargando (esqueleto), vacía,
 * error con reintento. La tabla real (thead/tbody) se proyecta como
 * contenido y solo se muestra cuando no hay ninguno de esos tres estados.
 */
@Component({
  selector: 'ui-table',
  imports: [UiButton],
  template: `
    @if (loading()) {
      <div class="ui-table-skeleton" role="status" aria-label="Cargando">
        @for (col of columns(); track $index) {
          <div class="ui-table-skel-col"></div>
        }
      </div>
      @for (row of skeletonRowsArray; track $index) {
        <div class="ui-table-skel-row">
          @for (col of columns(); track $index) {
            <div class="ui-table-skel-cell"></div>
          }
        </div>
      }
    } @else if (error()) {
      <div class="ui-table-error">
        <p>{{ errorMessage() || 'No pudimos cargar la información.' }}</p>
        <button uiButton variant="secondary" (click)="retry.emit()">Reintentar</button>
      </div>
    } @else if (empty()) {
      <ng-content select="[empty]"></ng-content>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ui-table-skeleton,
      .ui-table-skel-row {
        display: flex;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--hairline);
      }
      .ui-table-skel-col,
      .ui-table-skel-cell {
        flex: 1;
        height: 12px;
        background: var(--faint);
      }
      .ui-table-skel-col {
        height: 9px;
        max-width: 90px;
      }
      .ui-table-error {
        border: 1px solid var(--hairline);
        padding: 32px;
        text-align: left;
      }
      .ui-table-error p {
        margin: 0 0 14px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class UiTable {
  columns = input<string[]>([]);
  loading = input(false);
  error = input(false);
  errorMessage = input('');
  empty = input(false);
  skeletonRows = input(5);

  retry = output<void>();

  protected get skeletonRowsArray() {
    return Array.from({ length: this.skeletonRows() });
  }
}
