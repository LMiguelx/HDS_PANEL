import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/** Un punto de una serie — `value: null` = mes sin información (doc 93, sección 0: la línea se corta, nunca cae a 0). */
export interface LineChartPoint {
  label: string;
  value: number | null;
  /** Mismo punto del período anterior, para la línea punteada de comparación. */
  compareValue?: number | null;
}

export interface LineChartSeries {
  key: string;
  name: string;
  /** Nombre de un token de color, p. ej. `--chart-series-1`. */
  colorVar: string;
  points: LineChartPoint[];
  /** Índice en `points` a resaltar como "mes pico"; `null`/`undefined` = ninguno. */
  peakIndex?: number | null;
}

interface PlottedSeries extends LineChartSeries {
  linePath: string;
  compareLinePath: string;
  dots: { x: number; y: number; value: number; isPeak: boolean }[];
}

const PAD_LEFT = 54;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const FALLBACK_WIDTH = 640;

let instanceSeq = 0;

function trimDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "200 mil", "1.2 M" — abreviado por defecto del eje Y (doc 93, corrección de diseño). */
function defaultYAxisFormat(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trimDecimal(v / 1_000_000)} M`;
  if (abs >= 1_000) return `${trimDecimal(v / 1_000)} mil`;
  return String(Math.round(v));
}

/**
 * Gráfico de líneas en SVG, sin dependencias — doc 93, sección 6: el panel
 * no tiene librería de gráficos y no se agrega una sin consultarlo. Mide el
 * ancho real del contenedor con `ResizeObserver` y dibuja en coordenadas de
 * píxel 1:1 (el `viewBox` coincide siempre con el tamaño renderizado), para
 * que el texto y los trazos nunca se deformen al estirarse el contenedor.
 */
@Component({
  selector: 'ui-line-chart',
  template: `
    <div class="ulc">
      <div class="ulc-plot" #host [style.height.px]="height()">
        <svg
          class="ulc-svg"
          [attr.width]="width()"
          [attr.height]="height()"
          [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <defs>
            <pattern
              [attr.id]="hatchId"
              width="7"
              height="7"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="7" class="ulc-hatch-line" />
            </pattern>
          </defs>

          @if (noDataFromIndex(); as from) {
            <rect
              class="ulc-nodata-bg"
              [attr.x]="hitX(from)"
              [attr.y]="padTop"
              [attr.width]="width() - padRight - hitX(from)"
              [attr.height]="height() - padTop - padBottom"
            />
            <rect
              [attr.x]="hitX(from)"
              [attr.y]="padTop"
              [attr.width]="width() - padRight - hitX(from)"
              [attr.height]="height() - padTop - padBottom"
              [attr.fill]="'url(#' + hatchId + ')'"
            />
            @if (width() - padRight - hitX(from) > 34) {
              <text
                class="ulc-nodata-label"
                [attr.x]="(hitX(from) + width() - padRight) / 2"
                [attr.y]="(padTop + height() - padBottom) / 2"
                transform-origin="center"
                [attr.transform]="
                  'rotate(-90 ' +
                  (hitX(from) + width() - padRight) / 2 +
                  ' ' +
                  (padTop + height() - padBottom) / 2 +
                  ')'
                "
              >
                Sin información
              </text>
            }
          }

          @for (t of yTicks(); track t.value) {
            <line
              class="ulc-gridline"
              [attr.x1]="padLeft"
              [attr.x2]="width() - padRight"
              [attr.y1]="t.y"
              [attr.y2]="t.y"
            />
            <text class="ulc-ytick" [attr.x]="padLeft - 8" [attr.y]="t.y + 3">{{ t.text }}</text>
          }

          @if (hoverIndex(); as hi) {
            <line
              class="ulc-hover-line"
              [attr.x1]="xFor(hi - 1)"
              [attr.x2]="xFor(hi - 1)"
              [attr.y1]="padTop"
              [attr.y2]="height() - padBottom"
            />
          }

          @for (s of plotted(); track s.key) {
            @if (s.compareLinePath) {
              <path
                class="ulc-line ulc-line-compare"
                [attr.d]="s.compareLinePath"
                [style.stroke]="'var(' + s.colorVar + ')'"
              />
            }
            <path
              class="ulc-line"
              [attr.d]="s.linePath"
              [style.stroke]="'var(' + s.colorVar + ')'"
            />
            @for (d of s.dots; track $index) {
              @if (d.isPeak) {
                <circle
                  class="ulc-peak-ring"
                  [attr.cx]="d.x"
                  [attr.cy]="d.y"
                  r="7"
                  [style.stroke]="'var(' + s.colorVar + ')'"
                />
              }
              <circle
                class="ulc-dot"
                [class.ulc-dot-peak]="d.isPeak"
                [attr.cx]="d.x"
                [attr.cy]="d.y"
                [attr.r]="d.isPeak ? 4 : 2.5"
                [style.fill]="'var(' + s.colorVar + ')'"
              />
            }
          }

          @for (label of xLabels(); track $index) {
            <text
              class="ulc-xtick"
              [class.ulc-xtick-current]="hoverIndex() === $index + 1"
              [attr.x]="xFor($index)"
              [attr.y]="height() - 8"
            >
              {{ label }}
            </text>
          }

          <!-- columnas invisibles para hover/foco/clic, accesibles también sin mouse -->
          @for (label of xLabels(); track $index) {
            <rect
              class="ulc-hit"
              [attr.x]="hitX($index)"
              [attr.y]="padTop"
              [attr.width]="hitWidth()"
              [attr.height]="height() - padTop - padBottom"
              tabindex="0"
              role="button"
              [attr.aria-label]="label + ': ' + tooltipText($index)"
              (mouseenter)="hoverIndex.set($index + 1)"
              (focus)="hoverIndex.set($index + 1)"
              (mouseleave)="onLeave($index)"
              (blur)="onLeave($index)"
              (click)="toggleHover($index)"
            />
          }
        </svg>

        @if (hoverIndex(); as hi) {
          <div class="ulc-tooltip" [style.left.px]="xFor(hi - 1)">
            <div class="ulc-tooltip-title">{{ xLabels()[hi - 1] }}</div>
            @for (row of tooltipRows(hi - 1); track row.key) {
              <div class="ulc-tooltip-row">
                <span
                  class="ulc-tooltip-dot"
                  [style.background]="'var(' + row.colorVar + ')'"
                ></span>
                <span class="ulc-tooltip-name">{{ row.name }}</span>
                <span class="ulc-tooltip-value">{{ row.valueText }}</span>
                @if (row.isPeak) {
                  <span class="ulc-tooltip-peak">Mes pico</span>
                }
                @if (row.compareText) {
                  <span class="ulc-tooltip-compare">{{ row.compareText }}</span>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (legend() && series().length > 0) {
        <div class="ulc-legend" role="group" aria-label="Marcas del gráfico">
          @for (s of series(); track s.key) {
            <button
              type="button"
              class="ulc-legend-btn"
              [class.ulc-legend-off]="hiddenKeys().has(s.key)"
              [attr.aria-pressed]="!hiddenKeys().has(s.key)"
              (click)="toggleKey(s.key)"
            >
              <span
                class="ulc-legend-dot"
                [style.background]="hiddenKeys().has(s.key) ? '' : 'var(' + s.colorVar + ')'"
              ></span>
              {{ s.name }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ulc {
        width: 100%;
      }
      .ulc-plot {
        position: relative;
        width: 100%;
      }
      .ulc-svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .ulc-gridline {
        stroke: var(--hairline);
        stroke-width: 1;
      }
      .ulc-ytick {
        font-size: 10px;
        fill: var(--ink-muted);
        text-anchor: end;
        font-variant-numeric: var(--tnum);
      }
      .ulc-xtick {
        font-size: 10px;
        fill: var(--ink-muted);
        text-anchor: middle;
      }
      .ulc-xtick-current {
        fill: var(--ink);
        font-weight: 700;
      }
      .ulc-hover-line {
        stroke: var(--divider);
        stroke-width: 1;
      }
      .ulc-line {
        fill: none;
        stroke-width: 2;
      }
      .ulc-line-compare {
        stroke-dasharray: 4 3;
        opacity: 0.55;
      }
      .ulc-dot {
        opacity: 0;
      }
      .ulc-dot-peak {
        opacity: 1;
        stroke: var(--surface);
        stroke-width: 1.5;
      }
      .ulc-peak-ring {
        fill: none;
        stroke-width: 1.5;
        opacity: 0.45;
      }
      .ulc-hit {
        fill: transparent;
        cursor: pointer;
      }
      .ulc-hit:focus-visible {
        fill: color-mix(in srgb, var(--ink) 4%, transparent);
        outline: none;
      }
      .ulc-hatch-line {
        stroke: var(--divider);
        stroke-width: 1.5;
      }
      .ulc-nodata-bg {
        fill: var(--faint);
      }
      .ulc-nodata-label {
        font-size: 10px;
        fill: var(--ink-muted);
        text-anchor: middle;
        letter-spacing: 0.02em;
      }
      .ulc-tooltip {
        position: absolute;
        top: 2px;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1px solid var(--hairline);
        box-shadow: var(--shadow-card);
        border-radius: var(--radius-control);
        padding: 8px 10px;
        min-width: 160px;
        max-width: 240px;
        font-size: 12px;
        pointer-events: none;
        z-index: 2;
      }
      .ulc-tooltip-title {
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 4px;
      }
      .ulc-tooltip-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        color: var(--ink-muted);
      }
      .ulc-tooltip-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
      }
      .ulc-tooltip-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ulc-tooltip-value {
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .ulc-tooltip-peak {
        font-size: 10px;
        font-weight: 800;
        color: var(--accent-ink);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ulc-tooltip-compare {
        width: 100%;
        color: var(--ink-muted);
        font-size: 11px;
      }
      .ulc-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .ulc-legend-btn {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--hairline);
        background: var(--bg);
        border-radius: var(--radius-pill);
        padding: 5px 12px 5px 8px;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--ink);
        cursor: pointer;
      }
      .ulc-legend-btn:hover {
        border-color: var(--ink-muted);
      }
      .ulc-legend-off {
        color: var(--ink-muted);
        opacity: 0.6;
      }
      .ulc-legend-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
        border: 1px solid var(--hairline);
      }
    `,
  ],
})
export class UiLineChart {
  series = input.required<LineChartSeries[]>();
  height = input(220);
  /** Formatea el valor del tooltip, p. ej. `formatSoles`. */
  valueFormatter = input<(v: number) => string>((v) => String(v));
  /** Formatea las etiquetas del eje Y (por defecto, abreviado: "200 mil", "1.2 M"). */
  yAxisFormatter = input<(v: number) => string>(defaultYAxisFormat);
  showCompare = input(false);
  compareLabel = input('período anterior');
  /** Leyenda de botones de color para activar/desactivar series — doc 93. */
  legend = input(true);

  protected readonly padLeft = PAD_LEFT;
  protected readonly padRight = PAD_RIGHT;
  protected readonly padTop = PAD_TOP;
  protected readonly padBottom = PAD_BOTTOM;
  protected readonly hatchId = `ulc-hatch-${++instanceSeq}`;

  private hostEl = viewChild<ElementRef<HTMLDivElement>>('host');
  private containerWidth = signal(FALLBACK_WIDTH);
  protected width = computed(() => Math.max(200, Math.round(this.containerWidth())));

  /** 1-based para poder usar 0 como "nada" con `@if`; null = sin hover. */
  protected hoverIndex = signal<number | null>(null);
  protected hiddenKeys = signal<Set<string>>(new Set());

  protected visibleSeries = computed(() =>
    this.series().filter((s) => !this.hiddenKeys().has(s.key)),
  );
  protected xLabels = computed(() => this.series()[0]?.points.map((p) => p.label) ?? []);

  private plotWidth = computed(() => this.width() - this.padLeft - this.padRight);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.hostEl()?.nativeElement;
      if (!el) return;
      const update = (w: number) => {
        if (w > 0) this.containerWidth.set(w);
      };
      update(el.clientWidth);
      const ro = new ResizeObserver((entries) => update(entries[0].contentRect.width));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected xFor(index: number): number {
    const n = this.xLabels().length;
    if (n <= 1) return this.padLeft + this.plotWidth() / 2;
    return this.padLeft + (this.plotWidth() * index) / (n - 1);
  }

  protected hitX(index: number): number {
    const n = this.xLabels().length || 1;
    const w = this.plotWidth() / n;
    return this.padLeft + w * index;
  }

  protected hitWidth(): number {
    const n = this.xLabels().length || 1;
    return this.plotWidth() / n;
  }

  /** Primer índice, desde el final, donde TODAS las series quedan sin información en adelante (meses futuros). */
  protected noDataFromIndex = computed<number | null>(() => {
    const series = this.series();
    const n = this.xLabels().length;
    if (!series.length || !n) return null;
    let from: number | null = null;
    for (let i = n - 1; i >= 0; i--) {
      const allNull = series.every((s) => s.points[i]?.value == null);
      if (allNull) from = i;
      else break;
    }
    return from;
  });

  private maxValue = computed(() => {
    let max = 0;
    for (const s of this.visibleSeries()) {
      for (const p of s.points) {
        if (p.value != null) max = Math.max(max, p.value);
        if (this.showCompare() && p.compareValue != null) max = Math.max(max, p.compareValue);
      }
    }
    return max;
  });

  /** Redondea el techo del eje a un número "limpio" (1/2/5 × 10^n). */
  private niceMax = computed(() => {
    const max = this.maxValue();
    if (max <= 0) return 1;
    const exp = Math.floor(Math.log10(max));
    const base = Math.pow(10, exp);
    const normalized = max / base;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * base;
  });

  protected yTicks = computed(() => {
    const max = this.niceMax();
    const count = 4;
    const ticks: { value: number; y: number; text: string }[] = [];
    const plotHeight = this.height() - this.padTop - this.padBottom;
    const fmt = this.yAxisFormatter();
    for (let i = 0; i <= count; i++) {
      const value = (max / count) * i;
      const y = this.height() - this.padBottom - (plotHeight * value) / max;
      ticks.push({ value, y, text: fmt(value) });
    }
    return ticks;
  });

  private yFor(value: number): number {
    const max = this.niceMax();
    const plotHeight = this.height() - this.padTop - this.padBottom;
    return this.height() - this.padBottom - (plotHeight * value) / (max || 1);
  }

  /** Arma el `d` de un `<path>`, cortando la línea en cada tramo sin información. */
  private buildPath(points: (number | null | undefined)[]): string {
    let d = '';
    let drawing = false;
    points.forEach((v, i) => {
      if (v == null) {
        drawing = false;
        return;
      }
      const x = this.xFor(i);
      const y = this.yFor(v);
      d += drawing ? ` L ${x} ${y}` : `M ${x} ${y}`;
      drawing = true;
    });
    return d;
  }

  protected plotted = computed<PlottedSeries[]>(() =>
    this.visibleSeries().map((s) => ({
      ...s,
      linePath: this.buildPath(s.points.map((p) => p.value)),
      compareLinePath: this.showCompare()
        ? this.buildPath(s.points.map((p) => p.compareValue))
        : '',
      dots: s.points.flatMap((p, i) =>
        p.value != null
          ? [{ x: this.xFor(i), y: this.yFor(p.value), value: p.value, isPeak: s.peakIndex === i }]
          : [],
      ),
    })),
  );

  protected tooltipRows(index: number) {
    const fmt = this.valueFormatter();
    return this.visibleSeries().map((s) => {
      const p = s.points[index];
      return {
        key: s.key,
        name: s.name,
        colorVar: s.colorVar,
        isPeak: s.peakIndex === index,
        valueText: p?.value != null ? fmt(p.value) : 'sin información',
        compareText:
          this.showCompare() && p?.compareValue != null
            ? `${this.compareLabel()}: ${fmt(p.compareValue)}`
            : this.showCompare() && p?.compareValue == null
              ? `${this.compareLabel()}: sin información`
              : '',
      };
    });
  }

  protected tooltipText(index: number): string {
    const fmt = this.valueFormatter();
    return this.visibleSeries()
      .map((s) => {
        const p = s.points[index];
        return `${s.name}: ${p?.value != null ? fmt(p.value) : 'sin información'}`;
      })
      .join(', ');
  }

  protected ariaLabel(): string {
    return `Gráfico de líneas: ${this.visibleSeries()
      .map((s) => s.name)
      .join(', ')}`;
  }

  protected onLeave(index: number) {
    if (this.hoverIndex() === index + 1) this.hoverIndex.set(null);
  }

  protected toggleHover(index: number) {
    this.hoverIndex.set(this.hoverIndex() === index + 1 ? null : index + 1);
  }

  protected toggleKey(key: string) {
    this.hiddenKeys.update((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}
