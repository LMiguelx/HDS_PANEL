import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoService } from './promo';
import { LookupService } from './lookup';
import { dateText } from './promo-format';
import { quantityText } from '../sales-reports/sales-report-format';
import { formatSoles } from '../../shared/pipes/money';
import { PromoReachSummaryRow } from './promo-reach.models';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ExportColumn, ExportFormat, ExportTable } from '../../shared/utils/export/export.models';
import { exportFileName } from '../../shared/utils/export/export-file-name';

type SortKey = 'orderCount' | 'customerCount' | 'discountAmount';

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Comparar promociones — doc 47, sección 11. Pestaña "Alcance" del módulo
 * Promociones (no del detalle de una promoción): un rango, filtros de
 * marca/nombre y una tabla ordenable con fila de totales.
 */
@Component({
  selector: 'app-promo-reach-summary',
  imports: [UiField, UiTable, UiStatus, UiEmpty, UiExportMenu, PromoModuleTabs],
  template: `
    <app-promo-module-tabs />
    <section class="prs-page">
      <div class="prs-head">
        <h1>Alcance de promociones</h1>
        <p class="prs-sub">
          Solo se listan las promociones con pedidos en el rango elegido. Útil para comparar la
          misma promoción entre meses.
        </p>
      </div>

      <div class="prs-filters">
        <ui-field label="Desde" type="date" [(value)]="from" (valueChange)="load()" />
        <ui-field label="Hasta" type="date" [(value)]="to" (valueChange)="load()" />
        <ui-field
          label="Marca"
          type="select"
          [(value)]="brandId"
          [options]="brandOptions()"
          (valueChange)="load()"
        />
        <ui-field
          label="Buscar por nombre"
          placeholder="Escribe el nombre de la promoción"
          [(value)]="nameQuery"
        />
        <ui-export-menu
          [disabled]="rows().length === 0"
          [busy]="exporting()"
          (export)="exportTable($event)"
        />
      </div>

      <ui-table
        [columns]="columns"
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar el alcance de promociones."
        [empty]="!loading() && !error() && rows().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            title="Ninguna promoción tuvo pedidos en el rango elegido"
            body="Prueba con otro rango de fechas, marca o nombre."
          />
        </div>

        <table class="ui-table-grid prs-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Promoción</th>
              <th>Vigencia</th>
              <th>Estado</th>
              <th class="prs-col-right prs-sortable" (click)="toggleSort('orderCount')">
                Pedidos {{ sortArrow('orderCount') }}
              </th>
              <th class="prs-col-right prs-sortable" (click)="toggleSort('customerCount')">
                Clientes {{ sortArrow('customerCount') }}
              </th>
              <th class="prs-col-right prs-sortable" (click)="toggleSort('discountAmount')">
                Descuento {{ sortArrow('discountAmount') }}
              </th>
              <th class="prs-col-right">Unid.</th>
            </tr>
          </thead>
          <tbody>
            @for (p of sortedRows(); track p.promoId) {
              <tr class="prs-row-clickable" (click)="openDetail(p)">
                <td class="prs-muted">{{ p.code }}</td>
                <td class="prs-name">{{ p.name }}</td>
                <td class="prs-muted">{{ dateText(p.startDate) }} – {{ dateText(p.endDate) }}</td>
                <td><ui-status [label]="p.statusLabel" /></td>
                <td class="prs-col-right">{{ p.orderCount }}</td>
                <td class="prs-col-right">{{ p.customerCount }}</td>
                <td class="prs-col-right">{{ formatSoles(p.discountAmount) }}</td>
                <td class="prs-col-right">{{ p.bonusUnits ? quantityText(p.bonusUnits) : '—' }}</td>
              </tr>
            }
          </tbody>
          @if (rows().length > 0) {
            <tfoot>
              <tr class="prs-totals-row">
                <td colspan="4">
                  Total · {{ rows().length }} promoción{{ rows().length === 1 ? '' : 'es' }}
                </td>
                <td class="prs-col-right">{{ totals().orderCount }}</td>
                <td class="prs-col-right">—</td>
                <td class="prs-col-right">{{ formatSoles(totals().discountAmount) }}</td>
                <td class="prs-col-right">
                  {{ totals().bonusUnits ? quantityText(totals().bonusUnits) : '—' }}
                </td>
              </tr>
            </tfoot>
          }
        </table>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .prs-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .prs-head h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .prs-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 640px;
      }
      .prs-filters {
        display: flex;
        align-items: flex-end;
        gap: var(--sp-4);
        flex-wrap: wrap;
        margin: var(--sp-5) 0;
        padding-bottom: var(--sp-4);
        border-bottom: var(--border-hair);
      }
      .prs-filters ui-field {
        width: 200px;
      }
      .prs-table {
        width: 100%;
      }
      .prs-muted {
        color: var(--ink-muted);
      }
      .prs-name {
        font-weight: 700;
      }
      .prs-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .prs-sortable {
        cursor: pointer;
        user-select: none;
      }
      .prs-sortable:hover {
        color: var(--ink);
      }
      .prs-row-clickable {
        cursor: pointer;
      }
      .prs-row-clickable:hover {
        background: var(--faint);
      }
      .prs-totals-row td {
        font-weight: 800;
        border-top: 2px solid var(--divider);
      }

      @media (max-width: 767px) {
        .prs-page {
          padding: var(--sp-4);
        }
        .prs-filters ui-field {
          width: 100%;
        }
      }
    `,
  ],
})
export class PromoReachSummaryPage implements OnInit, OnDestroy {
  private promoSvc = inject(PromoService);
  private lookupSvc = inject(LookupService);
  private router = inject(Router);
  private exporter = inject(TableExporter);

  protected columns = [
    'Código',
    'Promoción',
    'Vigencia',
    'Estado',
    'Pedidos',
    'Clientes',
    'Descuento',
    'Unid.',
  ];

  protected dateText = dateText;
  protected quantityText = quantityText;
  protected formatSoles = formatSoles;

  protected from = signal(firstOfMonthIso());
  protected to = signal(todayIso());
  protected brandId = signal('');
  protected nameQuery = signal('');
  protected brandOptions = signal<UiFieldOption[]>([{ value: '', label: 'Todas las marcas' }]);

  protected rows = signal<PromoReachSummaryRow[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected exporting = signal(false);

  protected sortKey = signal<SortKey | null>(null);
  protected sortDir = signal<'asc' | 'desc'>('desc');

  protected sortedRows = computed(() => {
    const key = this.sortKey();
    const list = this.rows();
    if (!key) return list;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => (a[key] - b[key]) * dir);
  });

  protected totals = computed(() => {
    const list = this.rows();
    return {
      orderCount: list.reduce((n, p) => n + p.orderCount, 0),
      discountAmount: list.reduce((n, p) => n + p.discountAmount, 0),
      bonusUnits: list.reduce((n, p) => n + p.bonusUnits, 0),
    };
  });

  private reload$ = new Subject<void>();
  private nameEffect = effect(() => {
    this.nameQuery();
    this.reload$.next();
  });

  ngOnInit() {
    this.lookupSvc.brands().subscribe((items) => {
      this.brandOptions.set([
        { value: '', label: 'Todas las marcas' },
        ...items.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });
    this.reload$.pipe(debounceTime(250)).subscribe(() => this.load());
    this.load();
  }

  ngOnDestroy() {
    this.reload$.complete();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.promoSvc
      .reachSummary({
        from: this.from() || undefined,
        to: this.to() || undefined,
        brandId: this.brandId() ? Number(this.brandId()) : undefined,
        name: this.nameQuery() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.promos ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  protected sortArrow(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  protected openDetail(p: PromoReachSummaryRow) {
    this.router.navigate(['/promociones', p.promoId], {
      queryParams: { tab: 'alcance', from: this.from(), to: this.to() },
    });
  }

  protected exportTable(format: ExportFormat) {
    if (this.exporting()) return;
    this.exporting.set(true);
    const table = this.buildExportTable();
    this.exporter.export(table, format).finally(() => this.exporting.set(false));
  }

  private buildExportTable(): ExportTable<PromoReachSummaryRow> {
    const columns: ExportColumn<PromoReachSummaryRow>[] = [
      { key: 'code', header: 'Código', type: 'code', value: (row) => row.code },
      { key: 'name', header: 'Promoción', type: 'text', value: (row) => row.name },
      { key: 'startDate', header: 'Desde', type: 'date', value: (row) => row.startDate },
      { key: 'endDate', header: 'Hasta', type: 'date', value: (row) => row.endDate },
      { key: 'statusLabel', header: 'Estado', type: 'text', value: (row) => row.statusLabel },
      { key: 'orderCount', header: 'Pedidos', type: 'integer', value: (row) => row.orderCount },
      {
        key: 'customerCount',
        header: 'Clientes',
        type: 'integer',
        value: (row) => row.customerCount,
      },
      {
        key: 'discountAmount',
        header: 'Descuento',
        type: 'money',
        value: (row) => row.discountAmount,
      },
      {
        key: 'bonusUnits',
        header: 'Unidades',
        type: 'quantity',
        value: (row) => row.bonusUnits,
        emptyWhenZero: true,
      },
    ];
    return {
      title: 'Alcance de promociones',
      filters: [
        { label: 'Desde', value: dateText(this.from()) },
        { label: 'Hasta', value: dateText(this.to()) },
      ],
      columns,
      rows: this.sortedRows(),
      totals: {
        orderCount: this.totals().orderCount,
        discountAmount: this.totals().discountAmount,
        bonusUnits: this.totals().bonusUnits,
      },
      totalsLabel: 'Totales',
      fileName: exportFileName(['alcance-promociones', this.from(), this.to()]),
    };
  }
}
