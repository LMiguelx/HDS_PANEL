import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { ToastService } from '../../core/ui/toast';
import { DeliveryAdminService } from './delivery-admin';
import { AssignTeamDialog } from './ui/assign-team-dialog';
import { RepartoDayMap, DeliveryDayMapPoint } from './ui/reparto-day-map';
import { BatchCustomerView, BatchSummary } from '../../shared/models/delivery.models';
import { batchStatusName } from './delivery-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "martes 27/10/2026" — mockup de la sección 5.3. */
function todayLongText(iso: string): string {
  return format(parseISO(iso), 'EEEE dd/MM/yyyy', { locale: es });
}

/** Orden de la tabla — doc 50, sección 5.3: sin equipo primero, luego abiertas, en ruta y liquidadas. */
function sortRank(b: BatchSummary): number {
  if (!b.deliveryTeamId) return 0;
  if (b.statusCode === 'OPEN') return 1;
  if (b.statusCode === 'IN_ROUTE') return 2;
  return 3; // SETTLED
}

/**
 * Inicio de reparto (doc 50, sección 5) — home de quien organiza el reparto
 * del día y no vende: indicadores, barra de comprobantes, tabla de
 * planillas (con "Asignar equipo" en las abiertas sin equipo) y el mapa del
 * día con todas las planillas. Mismo endpoint que Planillas, sin paginar:
 * solo las del día.
 */
@Component({
  selector: 'app-delivery-home',
  imports: [UiButton, UiTable, UiStatus, UiEmpty, HasPermissionDirective, RepartoDayMap],
  template: `
    <section class="rh-page">
      <div class="rh-head">
        <div>
          <h1>Reparto del día</h1>
          <p class="rh-sub">{{ todayText }}</p>
        </div>
        <button uiButton variant="secondary" [loading]="loading()" (click)="load()">
          Actualizar
        </button>
      </div>

      @if (loading()) {
        <div class="rh-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el reparto del día"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (batches().length === 0) {
        <ui-empty title="Hoy no hay planillas" body="Aparecerán cuando el ERP las cargue." />
      } @else {
        <div class="rh-metrics">
          <div class="rh-metric">
            <span class="rh-metric-value">{{ batches().length }}</span>
            <span class="rh-metric-label">Planillas</span>
          </div>
          <div class="rh-metric" [class.rh-metric-alert]="sinEquipoCount() > 0">
            <span class="rh-metric-value">{{ sinEquipoCount() }}</span>
            <span class="rh-metric-label">Sin equipo</span>
          </div>
          <div class="rh-metric">
            <span class="rh-metric-value">{{ countByStatus('IN_ROUTE') }}</span>
            <span class="rh-metric-label">En ruta</span>
          </div>
          <div class="rh-metric">
            <span class="rh-metric-value">{{ countByStatus('SETTLED') }}</span>
            <span class="rh-metric-label">Liquidadas</span>
          </div>
          <div class="rh-metric">
            <span class="rh-metric-value">{{ formatSoles(totalAmount()) }}</span>
            <span class="rh-metric-label">Total</span>
          </div>
          <div class="rh-metric">
            <span class="rh-metric-value">{{ formatSoles(returnedAmount()) }}</span>
            <span class="rh-metric-label">Devuelto</span>
          </div>
        </div>

        <div class="rh-comprobantes">
          <h2 class="rh-section-title">Comprobantes del día</h2>
          <div class="rh-comp-bar-row">
            <span class="rh-comp-label rh-comp-delivered"
              >Entregados {{ comprobantes().delivered }}</span
            >
            <div class="rh-comp-bar">
              <div class="rh-comp-bar-fill" [style.width.%]="deliveredPercent()"></div>
            </div>
            <span class="rh-comp-label">Parciales {{ comprobantes().partial }}</span>
            <span class="rh-comp-label">Rechazados {{ comprobantes().rejected }}</span>
            <span class="rh-comp-label">Pendientes {{ comprobantes().pending }}</span>
          </div>
        </div>

        <h2 class="rh-section-title">Planillas de hoy</h2>
        <ui-table>
          <table class="ui-table-grid rh-table-desktop">
            <thead>
              <tr>
                <th>Planilla</th>
                <th>Equipo / placa</th>
                <th>Estado</th>
                <th>Comprobantes</th>
                <th>Total</th>
                <th>Devuelto</th>
                <th>Neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (b of sortedBatches(); track b.batchId) {
                <tr class="rh-row" (click)="goToBatch(b)">
                  <td class="rh-cell-strong">{{ b.series }}-{{ b.number }}</td>
                  <td [class.rh-muted-team]="!b.deliveryTeamId">
                    @if (b.deliveryTeamId) {
                      {{ b.vehiclePlate }}{{ b.driverName ? ' · ' + b.driverName : '' }}
                    } @else {
                      — sin equipo —
                    }
                  </td>
                  <td><ui-status [label]="statusName(b.statusCode)" /></td>
                  <td class="rh-muted">{{ attended(b) }}/{{ b.totalItems }} atendidos</td>
                  <td class="rh-muted">{{ formatSoles(b.totalAmount) }}</td>
                  <td class="rh-muted">
                    {{ b.returnedAmount > 0 ? formatSoles(b.returnedAmount) : '—' }}
                  </td>
                  <td class="rh-net">{{ formatSoles(b.netAmount) }}</td>
                  <td class="rh-row-action">
                    @if (b.statusCode === 'OPEN' && !b.deliveryTeamId) {
                      <button
                        type="button"
                        uiButton
                        variant="secondary"
                        size="sm"
                        *hasPermission="'delivery.manage'"
                        (click)="openAssignTeam($event, b)"
                      >
                        Asignar equipo
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="rh-cards-mobile">
            @for (b of sortedBatches(); track b.batchId) {
              <div class="rh-card-mobile" (click)="goToBatch(b)">
                <div class="rh-card-mobile-head">
                  <span class="rh-cell-strong">{{ b.series }}-{{ b.number }}</span>
                  <ui-status [label]="statusName(b.statusCode)" />
                </div>
                <div class="rh-muted" [class.rh-muted-team]="!b.deliveryTeamId">
                  @if (b.deliveryTeamId) {
                    {{ b.vehiclePlate }}{{ b.driverName ? ' · ' + b.driverName : '' }}
                  } @else {
                    — sin equipo —
                  }
                </div>
                <div class="rh-muted">{{ attended(b) }}/{{ b.totalItems }} atendidos</div>
                <div class="rh-net">Neto {{ formatSoles(b.netAmount) }}</div>
                @if (b.statusCode === 'OPEN' && !b.deliveryTeamId) {
                  <button
                    type="button"
                    uiButton
                    variant="secondary"
                    size="sm"
                    class="rh-card-mobile-action"
                    *hasPermission="'delivery.manage'"
                    (click)="openAssignTeam($event, b)"
                  >
                    Asignar equipo
                  </button>
                }
              </div>
            }
          </div>
        </ui-table>

        <h2 class="rh-section-title">Mapa del día</h2>
        @if (loadingMap()) {
          <div class="rh-skeleton" role="status" aria-label="Cargando mapa"></div>
        } @else {
          <app-reparto-day-map [batches]="batches()" [points]="mapPoints()" />
        }
      }
    </section>
  `,
  styles: [
    `
      .rh-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .rh-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .rh-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .rh-skeleton {
        height: 220px;
        background: var(--faint);
        margin-top: 20px;
      }
      .rh-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .rh-metric {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .rh-metric-alert {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .rh-metric-alert .rh-metric-value {
        color: var(--accent-ink);
      }
      .rh-metric-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .rh-metric-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .rh-section-title {
        font-size: 15px;
        font-weight: 700;
        margin: 28px 0 14px;
        color: var(--ink);
      }
      .rh-comprobantes {
        margin-top: 8px;
      }
      .rh-comp-bar-row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .rh-comp-label {
        font-size: 13px;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .rh-comp-delivered {
        font-weight: 700;
        color: var(--ink);
      }
      .rh-comp-bar {
        flex: 1;
        min-width: 160px;
        height: 10px;
        background: var(--faint);
        border: 1px solid var(--hairline);
      }
      .rh-comp-bar-fill {
        height: 100%;
        background: var(--st-delivered);
      }
      .rh-cell-strong {
        font-weight: 800;
      }
      .rh-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .rh-muted-team {
        color: var(--accent-ink);
        font-weight: 700;
      }
      .rh-net {
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .rh-row {
        cursor: pointer;
      }
      .rh-row:hover {
        background: var(--faint);
      }
      .rh-row-action {
        text-align: right;
      }
      .rh-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .rh-page {
          padding: var(--sp-4);
        }
        .rh-table-desktop {
          display: none;
        }
        .rh-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .rh-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
          cursor: pointer;
        }
        .rh-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .rh-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class DeliveryHomePage {
  private deliverySvc = inject(DeliveryAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected formatSoles = formatSoles;
  protected statusName = batchStatusName;
  protected todayText = todayLongText(todayIso());

  protected batches = signal<BatchSummary[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  protected mapPoints = signal<DeliveryDayMapPoint[]>([]);
  protected loadingMap = signal(false);

  protected sortedBatches = computed(() =>
    [...this.batches()].sort((a, b) => sortRank(a) - sortRank(b) || a.number - b.number),
  );

  protected sinEquipoCount = computed(() => this.batches().filter((b) => !b.deliveryTeamId).length);
  protected totalAmount = computed(() => this.batches().reduce((sum, b) => sum + b.totalAmount, 0));
  protected returnedAmount = computed(() =>
    this.batches().reduce((sum, b) => sum + b.returnedAmount, 0),
  );
  protected comprobantes = computed(() => {
    const totals = { pending: 0, delivered: 0, partial: 0, rejected: 0 };
    for (const b of this.batches()) {
      totals.pending += b.statusCounts.pending;
      totals.delivered += b.statusCounts.delivered;
      totals.partial += b.statusCounts.partial;
      totals.rejected += b.statusCounts.rejected;
    }
    return totals;
  });
  protected deliveredPercent = computed(() => {
    const c = this.comprobantes();
    const total = c.pending + c.delivered + c.partial + c.rejected;
    return total > 0 ? Math.round((c.delivered / total) * 100) : 0;
  });

  constructor() {
    this.load();
  }

  protected countByStatus(statusCode: string): number {
    return this.batches().filter((b) => b.statusCode === statusCode).length;
  }

  protected attended(b: BatchSummary): number {
    return b.totalItems - b.statusCounts.pending;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.deliverySvc.batchesToday(todayIso()).subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.loading.set(false);
        this.loadMap(batches);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private loadMap(batches: BatchSummary[]) {
    if (batches.length === 0) {
      this.mapPoints.set([]);
      return;
    }
    this.loadingMap.set(true);
    forkJoin(
      batches.map((b) =>
        this.deliverySvc
          .batchCustomers(b.batchId)
          .pipe(catchError(() => of([] as BatchCustomerView[]))),
      ),
    ).subscribe((results) => {
      const points: DeliveryDayMapPoint[] = [];
      batches.forEach((b, i) => {
        const batchLabel = `${b.series}-${b.number}`;
        for (const customer of results[i]) {
          points.push({ batchId: b.batchId, batchLabel, customer });
        }
      });
      this.mapPoints.set(points);
      this.loadingMap.set(false);
    });
  }

  protected goToBatch(b: BatchSummary) {
    this.router.navigate(['/reparto', b.batchId]);
  }

  protected openAssignTeam(ev: Event, b: BatchSummary) {
    ev.stopPropagation();
    this.dialog
      .open(AssignTeamDialog, { data: { batchId: b.batchId }, width: '420px' })
      .afterClosed()
      .subscribe((assigned) => {
        if (assigned) {
          this.toast.success('Equipo asignado.');
          this.load();
        }
      });
  }
}
