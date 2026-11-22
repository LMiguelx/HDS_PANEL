import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { PickingDayView } from '../domain/logistics.models';

/** Tarjeta 1 de "Picking y reparto" — doc 93, sección 2.6. */
@Component({
  selector: 'app-logistics-picking-day-card',
  imports: [RouterLink, UiButton, UiEmpty],
  template: `
    <div class="lpd-card">
      <div class="lpd-head">
        <h3>Picking del día</h3>
        <span class="lpd-total">{{ picking().totalBatches }}</span>
      </div>
      @if (picking().totalBatches === 0) {
        <ui-empty title="No hay planillas para hoy" />
      } @else {
        <div class="lpd-bar">
          <span class="lpd-seg lpd-seg-closed" [style.width.%]="closedPct()"></span>
          <span class="lpd-seg lpd-seg-open" [style.width.%]="100 - closedPct()"></span>
        </div>
        <p class="lpd-legend">
          <span class="lpd-dot lpd-dot-closed"></span>Cerradas {{ picking().pickingClosed }}
          <span class="lpd-dot lpd-dot-open"></span>Abiertas {{ picking().pickingOpen }}
        </p>
        @if (picking().notReadyToLeave > 0) {
          <p class="lpd-line lpd-line-warn">{{ picking().notReadyToLeave }} no pueden salir</p>
        }
        @if (picking().withoutTeam > 0) {
          <p class="lpd-line">{{ picking().withoutTeam }} sin equipo</p>
        }
      }
      <button
        uiButton
        variant="secondary"
        size="sm"
        class="lpd-action"
        routerLink="/reparto/picking"
      >
        Ir a Picking
      </button>
    </div>
  `,
  styles: [
    `
      .lpd-card {
        border: 1px solid var(--hairline);
        background: var(--surface);
        padding: 14px 16px;
        display: grid;
        gap: 8px;
        align-content: start;
      }
      .lpd-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      h3 {
        margin: 0;
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .lpd-total {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .lpd-bar {
        display: flex;
        height: 10px;
        background: var(--faint);
        overflow: hidden;
      }
      .lpd-seg {
        height: 100%;
      }
      .lpd-seg-closed {
        background: var(--success);
      }
      .lpd-seg-open {
        background: var(--ink-muted);
        opacity: 0.4;
      }
      .lpd-legend {
        margin: 0;
        font-size: 11px;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lpd-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .lpd-dot-closed {
        background: var(--success);
      }
      .lpd-dot-open {
        background: var(--ink-muted);
        opacity: 0.4;
        margin-left: 8px;
      }
      .lpd-line {
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lpd-line-warn {
        color: var(--status-warn);
        font-weight: 700;
      }
      .lpd-action {
        margin-top: 4px;
        justify-self: start;
      }
    `,
  ],
})
export class LogisticsPickingDayCard {
  picking = input.required<PickingDayView>();

  protected closedPct = computed(() => {
    const p = this.picking();
    return p.totalBatches ? Math.round((p.pickingClosed / p.totalBatches) * 100) : 0;
  });
}
