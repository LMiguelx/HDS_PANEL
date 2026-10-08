import { Component, input } from '@angular/core';

export type UiStepState = 'complete' | 'current' | 'upcoming';

export interface UiStep {
  label: string;
  state: UiStepState;
}

/**
 * Progreso de un formulario en pasos (ver DESIGN.md). Es solo indicador: no
 * navega ni oculta contenido — el formulario sigue siendo una sola página
 * con scroll; el estado de cada paso lo decide el llamador.
 */
@Component({
  selector: 'ui-stepper',
  template: `
    <ol class="ui-stepper">
      @for (step of steps(); track step.label; let i = $index; let last = $last) {
        <li class="ui-step" [class]="'ui-step-' + step.state">
          <span class="ui-step-dot">
            @if (step.state === 'complete') {
              <span class="material-icons" aria-hidden="true">check</span>
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="ui-step-label">{{ step.label }}</span>
          @if (!last) {
            <span class="ui-step-line"></span>
          }
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .ui-stepper {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        flex-wrap: wrap;
        gap: 4px;
      }
      .ui-step {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ui-step-dot {
        flex: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
        border: 2px solid var(--divider);
        color: var(--ink-muted);
      }
      .ui-step-dot .material-icons {
        font-size: 16px;
      }
      .ui-step-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .ui-step-line {
        width: 28px;
        height: 2px;
        background: var(--divider);
        margin: 0 4px;
      }
      .ui-step-current .ui-step-dot {
        border-color: var(--accent);
        background: var(--accent);
        color: var(--on-accent);
      }
      .ui-step-current .ui-step-label {
        color: var(--ink);
        font-weight: 700;
      }
      .ui-step-complete .ui-step-dot {
        border-color: var(--success);
        color: var(--success);
      }
      .ui-step-complete .ui-step-label {
        color: var(--ink);
      }

      @media (max-width: 599px) {
        .ui-step-label {
          display: none;
        }
      }
    `,
  ],
})
export class UiStepper {
  steps = input.required<UiStep[]>();
}
