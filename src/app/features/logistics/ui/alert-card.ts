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

const LEVEL_LABEL: Record<AlertLevel, string> = {
  ok: 'Al día',
  warn: 'Atención',
  danger: 'Urgente',
  info: 'Informativo',
  muted: 'Sin datos',
};

/**
 * Una de las 5 tarjetas de "Avisos importantes" — doc 93, sección 2.5.
 * Fondo tintado por nivel con ícono y etiqueta de nivel (el color nunca es
 * el único portador de información). Sin `route`, la tarjeta no navega
 * (devoluciones).
 */
@Component({
  selector: 'app-logistics-alert-card',
  imports: [RouterLink],
  template: `
    <a
      class="lac-card"
      [class.lac-clickable]="!!route()"
      [class.lac-ok]="level() === 'ok'"
      [style.background]="level() === 'ok' ? '' : tintBg()"
      [routerLink]="route()"
      [queryParams]="queryParams() ?? null"
      [attr.tabindex]="route() ? 0 : -1"
    >
      <div class="lac-top">
        <span class="material-icons lac-icon" [style.color]="colorVar()" aria-hidden="true">{{
          icon()
        }}</span>
        <span class="lac-level" [style.color]="colorVar()">{{ levelLabel() }}</span>
      </div>
      <span class="lac-value" [style.color]="level() === 'ok' ? '' : colorVar()">{{
        value()
      }}</span>
      <span class="lac-label">{{ label() }}</span>
      <span class="lac-detail">{{ detail() }}</span>
    </a>
  `,
  styles: [
    `
      .lac-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        height: 100%;
        box-sizing: border-box;
        border: 1px solid var(--hairline);
        border-radius: var(--radius-card);
        padding: 14px 16px;
        text-decoration: none;
        color: inherit;
        background: var(--surface);
        min-width: 0;
      }
      .lac-ok {
        background: var(--surface);
      }
      .lac-clickable {
        cursor: pointer;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      .lac-clickable:hover,
      .lac-clickable:focus-visible {
        border-color: var(--ink-muted);
      }
      .lac-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .lac-icon {
        font-size: 20px;
      }
      .lac-level {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .lac-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
        color: var(--ink);
        line-height: 1.1;
        margin-top: 2px;
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
  icon = input('info');
  route = input<string[] | null>(null);
  queryParams = input<Record<string, string> | null>(null);

  protected colorVar = computed(() => `var(${LEVEL_VAR[this.level() ?? 'muted']})`);
  protected levelLabel = computed(() => LEVEL_LABEL[this.level() ?? 'muted']);
  protected tintBg = computed(() => `color-mix(in srgb, ${this.colorVar()} 10%, var(--surface))`);
}
