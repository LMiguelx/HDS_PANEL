import { Component, input } from '@angular/core';

export type UiStatusStepState = 'complete' | 'current' | 'upcoming';

export interface UiStatusStep {
  label: string;
  state: UiStatusStepState;
  /** Texto bajo la etiqueta (fecha, "1 de 3 campos"); vacío si no aplica. */
  meta?: string;
}

/**
 * Línea de estado de 3 pasos (Solicitada → Registrada en el ERP → Aprobada),
 * compartida por las tres pestañas de Aprobaciones de clientes (doc 39,
 * sección 4.3). Solo pinta lo que recibe: el llamador decide el estado de
 * cada paso.
 */
@Component({
  selector: 'ui-status-steps',
  template: `
    <ol class="ui-status-steps">
      @for (step of steps(); track step.label; let i = $index; let last = $last) {
        <li class="ui-ss-step" [class]="'ui-ss-' + step.state">
          <div class="ui-ss-connector">
            <span class="ui-ss-dot"></span>
            @if (!last) {
              <span class="ui-ss-line" [class.ui-ss-line-done]="isLineDone(i)"></span>
            }
          </div>
          <span class="ui-ss-label">{{ step.label }}</span>
          @if (step.meta) {
            <span class="ui-ss-meta">{{ step.meta }}</span>
          }
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .ui-status-steps {
        display: flex;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .ui-ss-step {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .ui-ss-step:last-child {
        flex: none;
      }
      .ui-ss-connector {
        display: flex;
        align-items: center;
      }
      .ui-ss-dot {
        flex: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--hairline);
        background: var(--bg);
      }
      .ui-ss-line {
        flex: 1;
        height: 2px;
        background: var(--hairline);
        margin-left: 2px;
      }
      .ui-ss-line-done {
        background: var(--status-ok);
      }
      .ui-ss-label {
        font-size: var(--fs-dense);
        font-weight: 700;
        color: var(--ink);
        margin-top: 2px;
      }
      .ui-ss-meta {
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .ui-ss-complete .ui-ss-dot {
        border-color: var(--status-ok);
        background: var(--status-ok);
      }
      .ui-ss-current .ui-ss-dot {
        border-color: var(--status-warn);
      }
      .ui-ss-upcoming .ui-ss-label {
        color: var(--ink-muted);
        font-weight: 600;
      }
    `,
  ],
})
export class UiStatusSteps {
  steps = input.required<UiStatusStep[]>();

  /** La línea solo se pinta "hecha" entre dos pasos completos. */
  protected isLineDone(index: number): boolean {
    const list = this.steps();
    return list[index].state === 'complete' && list[index + 1]?.state === 'complete';
  }
}
