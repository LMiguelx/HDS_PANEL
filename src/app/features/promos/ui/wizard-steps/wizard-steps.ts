import { Component, input, output } from '@angular/core';

export interface UiWizardStep {
  label: string;
}

/**
 * Barra de 5 pasos (escritorio) / barra de progreso «Paso n de 5» (móvil).
 * Solo se puede navegar por clic a pasos ya visitados.
 */
@Component({
  selector: 'ui-wizard-steps',
  template: `
    <div class="ui-wizard-desktop">
      @for (step of steps(); track $index) {
        <button
          type="button"
          class="ui-wizard-step"
          [class.current]="$index === current()"
          [class.done]="$index < current() || visited().includes($index)"
          [class.has-error]="errorSteps().includes($index)"
          [disabled]="!canGo($index)"
          (click)="canGo($index) && stepChange.emit($index)"
        >
          <span class="ui-wizard-num">{{ $index + 1 }}</span>
          <span class="ui-wizard-label">{{ step.label }}</span>
        </button>
      }
    </div>

    <div class="ui-wizard-mobile">
      <div class="ui-wizard-eyebrow">Paso {{ current() + 1 }} de {{ steps().length }}</div>
      <div class="ui-wizard-bar">
        @for (step of steps(); track $index) {
          <span class="ui-wizard-seg" [class.filled]="$index <= current()"></span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ui-wizard-desktop {
        display: flex;
        border-top: 1px solid var(--hairline);
        border-bottom: var(--border-rule);
      }
      .ui-wizard-mobile {
        display: none;
      }

      .ui-wizard-step {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        min-height: var(--touch-min);
        border-bottom: 3px solid transparent;
        color: var(--ink-muted);
      }
      .ui-wizard-step:disabled {
        cursor: default;
      }
      .ui-wizard-step:not(:disabled):hover {
        background: var(--faint);
      }
      .ui-wizard-step.current {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .ui-wizard-step.has-error {
        color: var(--accent-ink);
      }
      .ui-wizard-num {
        width: 24px;
        height: 24px;
        border: 1px solid currentColor;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        flex: none;
      }
      .ui-wizard-step.current .ui-wizard-num,
      .ui-wizard-step.done .ui-wizard-num {
        background: var(--ink);
        color: var(--bg);
        border-color: var(--ink);
      }
      .ui-wizard-step.current .ui-wizard-num {
        background: var(--accent);
        border-color: var(--accent);
      }
      .ui-wizard-label {
        font-size: 13px;
        font-weight: 800;
        line-height: 1.25;
        text-align: left;
      }

      @media (max-width: 767px) {
        .ui-wizard-desktop {
          display: none;
        }
        .ui-wizard-mobile {
          display: block;
          padding: 14px 16px 0;
        }
        .ui-wizard-eyebrow {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-muted);
        }
        .ui-wizard-bar {
          display: flex;
          gap: 3px;
          margin-top: 8px;
        }
        .ui-wizard-seg {
          flex: 1;
          height: 4px;
          background: var(--hairline);
        }
        .ui-wizard-seg.filled {
          background: var(--accent);
        }
      }
    `,
  ],
})
export class UiWizardSteps {
  steps = input.required<UiWizardStep[]>();
  current = input(0);
  visited = input<number[]>([]);
  errorSteps = input<number[]>([]);

  stepChange = output<number>();

  protected canGo(index: number): boolean {
    return index === this.current() || this.visited().includes(index);
  }
}
