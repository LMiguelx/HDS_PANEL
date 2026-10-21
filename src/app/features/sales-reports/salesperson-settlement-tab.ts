import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiOptionCard } from '../../shared/ui/option-card/option-card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { SalesReportAdminService } from './sales-report-admin';
import { LookupService, toUiLookup } from '../promos/lookup';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ExportColumn, ExportFormat, ExportTable } from '../../shared/utils/export/export.models';
import { exportFileName } from '../../shared/utils/export/export-file-name';
import { columnScreenText, formatByType } from '../../shared/utils/export/export-values';
import { settlementColumns } from './domain/settlement.columns';
import { ToastService } from '../../core/ui/toast';
import {
  SalespersonSettlementReport,
  SalespersonSettlementRow,
  SettlementGroupBy,
} from '../../shared/models/sales-report.models';
import { dateText, timeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ORIGIN_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'FIELD', label: 'Campo' },
  { value: 'TELESALES', label: 'Televentas' },
  { value: 'COUNTER', label: 'Mostrador' },
];

const ORIGIN_NAME: Record<string, string> = {
  FIELD: 'Campo',
  TELESALES: 'Televentas',
  COUNTER: 'Mostrador',
};

/**
 * Liquidación de vendedores — GET /orders/reports/salesperson-settlement.
 * Doc 43: filtro por vendedor, "Ver por" (día/vendedor) con días
 * trabajados, y exportación a Excel/CSV con las mismas columnas visibles.
 */
@Component({
  selector: 'app-salesperson-settlement-tab',
  imports: [UiField, UiTypeahead, UiOptionCard, UiEmpty, UiExportMenu, SalesReportModuleTabs],
  templateUrl: './salesperson-settlement-tab.html',
  styleUrls: ['./salesperson-settlement-tab.scss'],
})
export class SalespersonSettlementTab {
  private reportSvc = inject(SalesReportAdminService);
  private lookupSvc = inject(LookupService);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected dateText = dateText;
  protected timeText = timeText;
  protected formatSoles = formatSoles;
  protected originOptions = ORIGIN_FILTER_OPTIONS;
  protected columnScreenText = columnScreenText;

  protected from = signal(todayIso());
  protected to = signal(todayIso());
  protected originFilter = signal('');
  protected salespersonFilter = signal<UiLookupItem | null>(null);
  protected groupBy = signal<SettlementGroupBy>('DAY');

  protected searchSalespeople = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  protected report = signal<SalespersonSettlementReport | null>(null);
  protected loading = signal(true);
  protected error = signal('');
  protected exporting = signal(false);
  protected exportProgressText = signal('');

  protected isSingleDay = computed(() => this.from() === this.to());

  protected columns = computed(() =>
    settlementColumns({
      groupBy: this.groupBy(),
      origin: this.originFilter() || null,
      multiDay: !this.isSingleDay(),
    }),
  );

  protected canExport = computed(
    () => !this.loading() && !this.error() && (this.report()?.rows.length ?? 0) > 0,
  );

  protected periodText = computed(() => {
    const r = this.report();
    if (!r) return '';
    return r.from === r.to ? dateText(r.from) : `${dateText(r.from)} al ${dateText(r.to)}`;
  });

  protected rowsForChart = computed(() => {
    const r = this.report();
    if (!r) return [];
    return [...r.rows].sort((a, b) => b.netAmount - a.netAmount);
  });

  protected chartMax = computed(() => Math.max(...this.rowsForChart().map((r) => r.netAmount), 1));

  /** Mismos totales que usa el exportador — sección 9.1 — para la fila "Sumas" en pantalla. */
  protected totalsMap = computed((): Record<string, number> => {
    const r = this.report();
    if (!r) return {};
    return {
      fieldOrderCount: r.totalFieldOrders,
      fieldNetAmount: r.totalFieldNetAmount,
      telesalesOrderCount: r.totalTelesalesOrders,
      telesalesNetAmount: r.totalTelesalesNetAmount,
      counterOrderCount: r.totalCounterOrders,
      counterNetAmount: r.totalCounterNetAmount,
      netAmount: r.totalNetAmount,
      weightKg: r.totalWeightKg,
    };
  });

  /** Barras: solo tiene sentido con un día (por día) o con cualquier rango (por vendedor) — sección 5.7. */
  protected showChart = computed(() => this.groupBy() === 'SALESPERSON' || this.isSingleDay());

  /** Query params opcionales para volver con los filtros ya aplicados — sección 5.4. */
  fromParam = input<string | undefined>(undefined, { alias: 'from' });
  toParam = input<string | undefined>(undefined, { alias: 'to' });
  originParam = input<string | undefined>(undefined, { alias: 'origin' });
  salespersonIdParam = input<string | undefined>(undefined, { alias: 'salesperson' });
  salespersonNameParam = input<string | undefined>(undefined, { alias: 'salespersonName' });
  groupByParam = input<string | undefined>(undefined, { alias: 'groupBy' });

  constructor() {
    // Semilla desde la URL — declarado ANTES del efecto de carga para que
    // corra primero y no dispare una carga con los valores por defecto
    // seguida de otra con los sembrados (ARCHITECTURE_PANEL, D3).
    effect(() => {
      const from = this.fromParam();
      const to = this.toParam();
      const origin = this.originParam();
      const salespersonId = this.salespersonIdParam();
      const salespersonName = this.salespersonNameParam();
      const groupBy = this.groupByParam();
      untracked(() => {
        if (from) this.from.set(from);
        if (to) this.to.set(to);
        if (origin) this.originFilter.set(origin);
        if (salespersonId && salespersonName) {
          this.salespersonFilter.set({ id: Number(salespersonId), name: salespersonName });
        }
        if (groupBy === 'SALESPERSON') this.groupBy.set('SALESPERSON');
      });
    });

    effect(() => {
      this.from();
      this.to();
      this.originFilter();
      this.salespersonFilter();
      this.groupBy();
      untracked(() => {
        this.syncUrl();
        this.load();
      });
    });
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.reportSvc
      .salespersonSettlement(
        this.from(),
        this.to(),
        this.originFilter() || undefined,
        this.salespersonFilter()?.id,
        this.groupBy(),
      )
      .subscribe({
        next: (result) => {
          this.report.set(result);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos cargar la liquidación de vendedores.');
        },
      });
  }

  private syncUrl() {
    this.router.navigate([], {
      queryParams: {
        from: this.from(),
        to: this.to(),
        origin: this.originFilter() || null,
        salesperson: this.salespersonFilter()?.id ?? null,
        salespersonName: this.salespersonFilter()?.name ?? null,
        groupBy: this.groupBy() !== 'DAY' ? this.groupBy() : null,
      },
      replaceUrl: true,
    });
  }

  protected barPct(amount: number): number {
    return Math.round((amount / this.chartMax()) * 100);
  }

  /** Texto de la fila "Sumas": vacío salvo en las columnas con total conocido. */
  protected footerText(column: ExportColumn<SalespersonSettlementRow>): string {
    const totals = this.totalsMap();
    if (!(column.key in totals)) return '';
    return formatByType(column.type, totals[column.key], column.emptyWhenZero);
  }

  protected clearFilters() {
    this.from.set(todayIso());
    this.to.set(todayIso());
    this.originFilter.set('');
    this.salespersonFilter.set(null);
    this.groupBy.set('DAY');
  }

  protected openOrders(row: SalespersonSettlementRow) {
    const r = this.report();
    if (!r) return;
    this.router.navigate(['/pedidos'], {
      queryParams: {
        salespersonId: row.salespersonId,
        salespersonName: row.salespersonName,
        from: row.date ?? r.from,
        to: row.date ?? r.to,
        originCode: this.originFilter() || undefined,
      },
    });
  }

  protected onExport(format: ExportFormat) {
    const r = this.report();
    if (!r || this.exporting()) return;
    this.exporting.set(true);
    this.exportProgressText.set('');

    const table = this.buildTable(r);
    this.exporter
      .export(table, format)
      .then(() => {
        this.exporting.set(false);
        this.toast.success(`Archivo descargado: ${table.fileName}.${format}`);
      })
      .catch((err: unknown) => {
        this.exporting.set(false);
        const message =
          err instanceof Error ? err.message : 'No pudimos generar el archivo. Intenta de nuevo.';
        this.toast.error(message);
      });
  }

  private buildTable(r: SalespersonSettlementReport): ExportTable<SalespersonSettlementRow> {
    const columns = this.columns();
    return {
      title:
        this.groupBy() === 'SALESPERSON' ? 'Liquidación por vendedor' : 'Liquidación de vendedores',
      subtitle: r.salespersonName ?? undefined,
      filters: [
        { label: 'Desde', value: dateText(r.from) },
        { label: 'Hasta', value: dateText(r.to) },
        {
          label: 'Origen',
          value: r.originCode ? (ORIGIN_NAME[r.originCode] ?? r.originCode) : 'Todos',
        },
        { label: 'Vendedor', value: r.salespersonName ?? 'Todos' },
        { label: 'Ver por', value: this.groupBy() === 'DAY' ? 'Día' : 'Vendedor' },
      ],
      columns,
      rows: r.rows,
      totals: this.totalsMap(),
      totalsLabel: 'Sumas',
      footnote: r.lastOrderAt
        ? `Último pedido registrado a las ${timeText(r.lastOrderAt)} del ${dateText(r.lastOrderAt)}`
        : undefined,
      fileName: this.buildFileName(r),
    };
  }

  private buildFileName(r: SalespersonSettlementReport): string {
    if (r.salespersonName) {
      return exportFileName(['liquidacion', r.salespersonName, r.from, r.to]);
    }
    if (this.groupBy() === 'SALESPERSON') {
      return exportFileName(['liquidacion-por-vendedor', r.from, r.to]);
    }
    return exportFileName(['liquidacion-vendedores', r.from, r.to]);
  }
}
