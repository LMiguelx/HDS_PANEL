import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertLevel } from '../domain/logistics.format';

const LEVEL_VAR: Record<AlertLevel, string> = {
  ok: '--status-ok',
  warn: '--status-warn',
  danger: '--status-danger',
  info: '--st-open',
  muted: '--ink-muted',
};

/**
 * Una de las 5 tarjetas de "Avisos importantes" — doc 93, sección 2.5. El
 * color acompaña al texto (nunca es el único portador): el nivel también
 * se lee en `detail`. Sin `route`, la tarjeta no navega (devoluciones).
 */
@Component({
  selector: 'app-logistics-alert-card',
  imports: [RouterLink],
  template: `
    <a
      class="lac-card"
      [class.lac-clickable]="!!route()"
      [style.borderLeftColor]="colorVar()"
      [routerLink]="route()"
      [queryParams]="queryParams() ?? null"
      [attr.tabindex]="route() ? 0 : -1"
    >
      <span class="lac-value" [style.color]="colorVar()">{{ value() }}</span>
      <span class="lac-label">{{ label() }}</span>
      <span class="lac-detail">{{ detail() }}</span>
    </a>
  `,
  styles: [
    `
      .lac-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border: 1px solid var(--hairline);
        border-left: 3px solid var(--hairline);
        padding: 12px 14px;
        text-decoration: none;
        color: inherit;
        background: var(--surface);
        min-width: 0;
      }
      .lac-clickable {
        cursor: pointer;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      .lac-clickable:hover,
      .lac-clickable:focus-visible {
        border-color: var(--ink-muted);
      }
      .lac-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
        color: var(--ink);
        line-height: 1.1;
      }
      .lac-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink);
      }
      .lac-detail {
        font-size: 11px;
        color: var(--ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class LogisticsAlertCard {
  value = input.required<string | number>();
  label = input.required<string>();
  detail = input('');
  level = input<AlertLevel | null>(null);
  route = input<string[] | null>(null);
  queryParams = input<Record<string, string> | null>(null);

  protected colorVar = computed(() => `var(${LEVEL_VAR[this.level() ?? 'muted']})`);
}
