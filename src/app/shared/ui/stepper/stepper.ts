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
      @for (step of steps(); track step.label; let i = $index) {
        <li class="ui-step" [class]="'ui-step-' + step.state">
          <span class="ui-step-dot">
            @if (step.state === 'complete') {
              <span class="material-icons" aria-hidden="true">check</span>
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="ui-step-label">{{ step.label }}</span>
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
        gap: var(--sp-2);
      }
      .ui-step {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 6px var(--sp-4) 6px 6px;
        border-radius: var(--radius-pill);
        border: 1.5px solid var(--divider);
        background: var(--surface);
      }
      .ui-step-dot {
        flex: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        border: 2px solid var(--divider);
        color: var(--ink-muted);
        background: var(--surface);
      }
      .ui-step-dot .material-icons {
        font-size: 15px;
      }
      .ui-step-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .ui-step-current {
        border-color: var(--accent);
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
        background: var(--success);
        color: var(--on-accent);
      }
      .ui-step-complete .ui-step-label {
        color: var(--ink);
      }

      @media (max-width: 599px) {
        .ui-step-label {
          display: none;
        }
        .ui-step {
          padding: 6px;
        }
      }
    `,
  ],
})
export class UiStepper {
  steps = input.required<UiStep[]>();
}
