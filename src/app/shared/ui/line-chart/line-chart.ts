import { Component, computed, input, signal } from '@angular/core';

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

const WIDTH = 600;
const PAD_LEFT = 44;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

/**
 * Gráfico de líneas en SVG, sin dependencias — doc 93, sección 6: el panel
 * no tiene librería de gráficos y no se agrega una sin consultarlo. Pensado
 * para series mensuales (Inicio de logística y "Marcas por mes"), pero sirve
 * para cualquier serie por etiqueta. Solo dibuja: la leyenda la arma quien
 * lo use, porque cada pantalla la necesita distinta.
 */
@Component({
  selector: 'ui-line-chart',
  template: `
    <div class="ulc" [style.height.px]="height()">
      <svg
        class="ulc-svg"
        [attr.viewBox]="'0 0 ' + width + ' ' + height()"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <!-- líneas guía horizontales -->
        @for (t of yTicks(); track t.value) {
          <line
            class="ulc-gridline"
            [attr.x1]="padLeft"
            [attr.x2]="width - padRight"
            [attr.y1]="t.y"
            [attr.y2]="t.y"
          />
          <text class="ulc-ytick" [attr.x]="padLeft - 6" [attr.y]="t.y + 3">{{ t.text }}</text>
        }

        <!-- columna resaltada bajo el mouse/foco -->
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
          <path class="ulc-line" [attr.d]="s.linePath" [style.stroke]="'var(' + s.colorVar + ')'" />
          @for (d of s.dots; track $index) {
            <circle
              class="ulc-dot"
              [class.ulc-dot-peak]="d.isPeak"
              [attr.cx]="d.x"
              [attr.cy]="d.y"
              [attr.r]="d.isPeak ? 4.5 : 2.5"
              [style.fill]="'var(' + s.colorVar + ')'"
            />
          }
        }

        @for (label of xLabels(); track $index) {
          <text class="ulc-xtick" [attr.x]="xFor($index)" [attr.y]="height() - 6">{{ label }}</text>
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
        <div class="ulc-tooltip" [style.left.%]="tooltipLeftPct(hi - 1)">
          <div class="ulc-tooltip-title">{{ xLabels()[hi - 1] }}</div>
          @for (row of tooltipRows(hi - 1); track row.key) {
            <div class="ulc-tooltip-row">
              <span class="ulc-tooltip-dot" [style.background]="'var(' + row.colorVar + ')'"></span>
              <span class="ulc-tooltip-name">{{ row.name }}</span>
              <span class="ulc-tooltip-value">{{ row.valueText }}</span>
              @if (row.compareText) {
                <span class="ulc-tooltip-compare">{{ row.compareText }}</span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ulc {
        position: relative;
        width: 100%;
      }
      .ulc-svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .ulc-gridline {
        stroke: var(--hairline);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .ulc-ytick {
        font-size: 9px;
        fill: var(--ink-muted);
        text-anchor: end;
        font-variant-numeric: var(--tnum);
      }
      .ulc-xtick {
        font-size: 9px;
        fill: var(--ink-muted);
        text-anchor: middle;
      }
      .ulc-hover-line {
        stroke: var(--divider);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .ulc-line {
        fill: none;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
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
        vector-effect: non-scaling-stroke;
      }
      .ulc-hit {
        fill: transparent;
        cursor: pointer;
      }
      .ulc-hit:focus-visible {
        fill: color-mix(in srgb, var(--ink) 4%, transparent);
        outline: none;
      }
      .ulc-tooltip {
        position: absolute;
        top: 4px;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1px solid var(--hairline);
        box-shadow: var(--shadow-card);
        padding: 8px 10px;
        min-width: 150px;
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
        gap: 6px;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .ulc-tooltip-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
      }
      .ulc-tooltip-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ulc-tooltip-value {
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .ulc-tooltip-compare {
        color: var(--ink-muted);
        font-size: 11px;
      }
    `,
  ],
})
export class UiLineChart {
  series = input.required<LineChartSeries[]>();
  height = input(220);
  /** Formatea un valor del eje Y y del tooltip, p. ej. `formatSoles`. */
  valueFormatter = input<(v: number) => string>((v) => String(v));
  showCompare = input(false);
  compareLabel = input('período anterior');

  protected readonly width = WIDTH;
  protected readonly padLeft = PAD_LEFT;
  protected readonly padRight = PAD_RIGHT;
  protected readonly padTop = PAD_TOP;
  protected readonly padBottom = PAD_BOTTOM;

  /** 1-based para poder usar 0 como "nada" con `@if`; null = sin hover. */
  protected hoverIndex = signal<number | null>(null);

  protected xLabels = computed(() => this.series()[0]?.points.map((p) => p.label) ?? []);

  private plotWidth = computed(() => this.width - this.padLeft - this.padRight);

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

  protected tooltipLeftPct(index: number): number {
    return (this.xFor(index) / this.width) * 100;
  }

  private maxValue = computed(() => {
    let max = 0;
    for (const s of this.series()) {
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
    for (let i = 0; i <= count; i++) {
      const value = (max / count) * i;
      const y = this.height() - this.padBottom - (plotHeight * value) / max;
      ticks.push({ value, y, text: this.valueFormatter()(value) });
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
    this.series().map((s) => ({
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
    return this.series().map((s) => {
      const p = s.points[index];
      return {
        key: s.key,
        name: s.name,
        colorVar: s.colorVar,
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
    return this.series()
      .map((s) => {
        const p = s.points[index];
        return `${s.name}: ${p?.value != null ? fmt(p.value) : 'sin información'}`;
      })
      .join(', ');
  }

  protected ariaLabel(): string {
    return `Gráfico de líneas: ${this.series()
      .map((s) => s.name)
      .join(', ')}`;
  }

  protected onLeave(index: number) {
    if (this.hoverIndex() === index + 1) this.hoverIndex.set(null);
  }

  protected toggleHover(index: number) {
    this.hoverIndex.set(this.hoverIndex() === index + 1 ? null : index + 1);
  }
}
