import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { AuthService } from '../../core/auth/auth';
import { DeliveryAdminService } from './delivery-admin';
import { AssignTeamDialog } from './ui/assign-team-dialog';
import { ReturnsDialog } from './ui/returns-dialog';
import { BatchMap } from './ui/batch-map';
import { BatchCustomerView, BatchDetail, MemberTotals } from '../../shared/models/delivery.models';
import {
  ITEM_STATUS_OPTIONS,
  batchStatusName,
  itemStatusName,
  roleInTeamName,
} from './delivery-format';
import { dateText, dateTimeText, timeText } from '../assignments/assignment-format';
import { formatSoles } from '../../shared/pipes/money';

const ITEM_STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos los estados' },
  ...ITEM_STATUS_OPTIONS.map((o) => ({ value: o.code, label: o.name })),
];

const UNATTENDED_FILTER_VALUE = '__none__';

/** Detalle de una planilla: comprobantes + mapa de entregas. */
@Component({
  selector: 'app-delivery-batch-detail',
  imports: [RouterLink, UiButton, UiField, UiStatus, UiEmpty, BatchMap, HasPermissionDirective],
  template: `
    <section class="dbd-page">
      @if (loading()) {
        <div class="dbd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la planilla"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (batch(); as b) {
        <div class="dbd-head">
          <div>
            <ui-status [label]="statusName(b.statusCode)" />
            <h1>Planilla {{ b.series }}-{{ b.number }}</h1>
            <p class="dbd-meta">
              {{ dateText(b.batchDate) }} ·
              {{ b.vehiclePlate ? b.vehiclePlate + ' · ' + b.driverName : 'Sin equipo asignado' }}
            </p>
          </div>
          <div class="dbd-actions" *hasPermission="'delivery.settle'">
            @if (b.statusCode === 'OPEN') {
              <button uiButton variant="secondary" (click)="openAssignTeam(b)">
                Asignar equipo
              </button>
            }
            <button
              uiButton
              variant="primary"
              [disabled]="!canSettle(b)"
              [loading]="settling()"
              (click)="settle(b)"
            >
              Liquidar
            </button>
          </div>
        </div>

        @if (b.statusCode !== 'OPEN') {
          <p class="dbd-hint">
            El equipo solo se puede asignar o reasignar mientras la planilla está Abierta.
          </p>
        }
        @if (b.statusCode !== 'SETTLED' && pendingCount() > 0) {
          <p class="dbd-hint">
            Faltan {{ pendingCount() }} comprobante{{ pendingCount() === 1 ? '' : 's' }} en
            Pendiente para poder liquidar.
          </p>
        }

        <div class="dbd-metrics">
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ formatSoles(b.totalAmount) }}</span>
            <span class="dbd-metric-label">Total</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ formatSoles(b.returnedAmount) }}</span>
            <span class="dbd-metric-label">Devuelto</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ formatSoles(b.netAmount) }}</span>
            <span class="dbd-metric-label">Neto a liquidar</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ b.totalWeight }} kg</span>
            <span class="dbd-metric-label">Peso</span>
          </div>
          <div class="dbd-metric">
            <span class="dbd-metric-value">{{ pct(b) }}%</span>
            <span class="dbd-metric-label">Resueltos</span>
          </div>
          @if (b.settledAt) {
            <div class="dbd-metric">
              <span class="dbd-metric-value">{{ dateTimeText(b.settledAt) }}</span>
              <span class="dbd-metric-label">Liquidada el</span>
            </div>
          }
        </div>

        @if (b.returnedAmount > 0) {
          <p class="dbd-hint dbd-hint-alert">
            {{ b.returnedProductCount }} producto{{
              b.returnedProductCount === 1 ? '' : 's'
            }}
            devuelto{{ b.returnedProductCount === 1 ? '' : 's' }}, {{ b.returnedQuantity }} unidad{{
              b.returnedQuantity === 1 ? '' : 'es'
            }}.
          </p>
        }

        <div class="dbd-tabs">
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'items'"
            (click)="view.set('items')"
          >
            Comprobantes
          </button>
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'team'"
            (click)="view.set('team')"
          >
            Equipo
          </button>
          <button
            type="button"
            class="dbd-tab"
            [class.on]="view() === 'map'"
            (click)="view.set('map')"
          >
            Mapa
          </button>
        </div>

        @if (view() === 'items') {
          <div class="dbd-filters">
            <ui-field
              label="Estado"
              type="select"
              [(value)]="itemStatusFilter"
              [options]="itemStatusOptions"
            />
            <ui-field
              label="Atendido por"
              type="select"
              [(value)]="attendedByFilter"
              [options]="attendedByOptions()"
            />
          </div>

          <table class="ui-table-grid dbd-table-desktop">
            <thead>
              <tr>
                <th>#</th>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Atendido por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.lineNumber) {
                <tr>
                  <td class="dbd-muted">{{ item.lineNumber }}</td>
                  <td class="dbd-cell-strong">
                    @if (canViewInvoice()) {
                      <a [routerLink]="['/factura', item.invoiceId]" class="dbd-invoice-link">{{
                        item.invoiceId
                      }}</a>
                    } @else {
                      {{ item.invoiceId }}
                    }
                  </td>
                  <td>{{ item.customerName }}</td>
                  <td class="dbd-muted">
                    @if (item.returnedAmount > 0) {
                      <span class="dbd-item-struck">{{ formatSoles(item.amount) }}</span>
                      {{ formatSoles(item.netAmount) }}
                    } @else {
                      {{ formatSoles(item.amount) }}
                    }
                  </td>
                  <td><ui-status [label]="itemStatusText(item.statusCode)" /></td>
                  <td class="dbd-muted">
                    @if (item.registeredByName) {
                      {{ item.registeredByName }}
                      <div class="dbd-attended-time">{{ timeText(item.registeredAt) }}</div>
                    } @else {
                      —
                    }
                  </td>
                  <td class="dbd-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      *hasPermission="['delivery.return', 'delivery.settle', 'customer.view']"
                      (click)="viewReturns(item)"
                    >
                      Devoluciones
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="dbd-cards-mobile">
            @for (item of filteredItems(); track item.lineNumber) {
              <div class="dbd-card-mobile">
                <div class="dbd-card-mobile-head">
                  @if (canViewInvoice()) {
                    <a [routerLink]="['/factura', item.invoiceId]" class="dbd-invoice-link">{{
                      item.invoiceId
                    }}</a>
                  } @else {
                    <span class="dbd-card-mobile-name">{{ item.invoiceId }}</span>
                  }
                  <ui-status [label]="itemStatusText(item.statusCode)" />
                </div>
                <div class="dbd-muted">
                  {{ item.customerName }} ·
                  @if (item.returnedAmount > 0) {
                    <span class="dbd-item-struck">{{ formatSoles(item.amount) }}</span>
                    {{ formatSoles(item.netAmount) }}
                  } @else {
                    {{ formatSoles(item.amount) }}
                  }
                </div>
                <div class="dbd-muted">
                  Atendido por:
                  @if (item.registeredByName) {
                    {{ item.registeredByName }} · {{ timeText(item.registeredAt) }}
                  } @else {
                    —
                  }
                </div>
                <button
                  uiButton
                  variant="ghost"
                  size="sm"
                  class="dbd-card-mobile-action"
                  *hasPermission="['delivery.return', 'delivery.settle', 'customer.view']"
                  (click)="viewReturns(item)"
                >
                  Devoluciones
                </button>
              </div>
            }
          </div>
        } @else if (view() === 'team') {
          @if (!b.deliveryTeamId && b.memberTotals.length === 0) {
            <ui-empty
              title="Esta planilla aún no tiene equipo asignado"
              body="Asigna un conductor y sus ayudantes para repartir los comprobantes."
              [actionLabel]="canAssignTeam() ? 'Asignar equipo' : ''"
              (action)="openAssignTeam(b)"
            />
          } @else {
            <table class="ui-table-grid dbd-table-desktop">
              <thead>
                <tr>
                  <th>Integrante</th>
                  <th>Rol</th>
                  <th>Comprob.</th>
                  <th>Monto</th>
                  <th>Devuelto</th>
                  <th>Neto a rendir</th>
                </tr>
              </thead>
              <tbody>
                @for (m of b.memberTotals; track m.userId) {
                  <tr class="dbd-team-row" (click)="openMember(m)">
                    <td class="dbd-cell-strong">{{ m.fullName }}</td>
                    <td [class.dbd-muted]="!m.roleInTeam">{{ roleInTeamName(m.roleInTeam) }}</td>
                    <td class="dbd-muted">{{ m.invoices }}</td>
                    <td class="dbd-muted">{{ formatSoles(m.amount) }}</td>
                    <td class="dbd-muted">{{ formatSoles(m.returnedAmount) }}</td>
                    <td class="dbd-cell-strong">{{ formatSoles(m.netAmount) }}</td>
                  </tr>
                }
                @if (b.pendingAmount > 0) {
                  <tr class="dbd-team-row dbd-team-row-dim" (click)="openUnattended()">
                    <td class="dbd-cell-strong" colspan="2">Sin atender</td>
                    <td class="dbd-muted">{{ unattendedCount() }}</td>
                    <td class="dbd-muted">{{ formatSoles(b.pendingAmount) }}</td>
                    <td class="dbd-muted">—</td>
                    <td class="dbd-cell-strong">{{ formatSoles(b.pendingAmount) }}</td>
                  </tr>
                }
                <tr class="dbd-team-row-total">
                  <td class="dbd-cell-strong" colspan="2">Total</td>
                  <td class="dbd-cell-strong">{{ b.items.length }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.totalAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.returnedAmount) }}</td>
                  <td class="dbd-cell-strong">{{ formatSoles(b.netAmount) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="dbd-cards-mobile">
              @for (m of b.memberTotals; track m.userId) {
                <div class="dbd-card-mobile dbd-card-mobile-click" (click)="openMember(m)">
                  <div class="dbd-card-mobile-head">
                    <span class="dbd-card-mobile-name">{{ m.fullName }}</span>
                    <span [class.dbd-muted]="!m.roleInTeam">{{
                      roleInTeamName(m.roleInTeam)
                    }}</span>
                  </div>
                  <div class="dbd-muted">
                    {{ m.invoices }} comprob. · {{ formatSoles(m.amount) }} · devuelto
                    {{ formatSoles(m.returnedAmount) }}
                  </div>
                  <div class="dbd-cell-strong">Neto a rendir: {{ formatSoles(m.netAmount) }}</div>
                </div>
              }
              @if (b.pendingAmount > 0) {
                <div
                  class="dbd-card-mobile dbd-card-mobile-click dbd-team-row-dim"
                  (click)="openUnattended()"
                >
                  <div class="dbd-card-mobile-head">
                    <span class="dbd-card-mobile-name">Sin atender</span>
                  </div>
                  <div class="dbd-cell-strong">Neto: {{ formatSoles(b.pendingAmount) }}</div>
                </div>
              }
              <div class="dbd-card-mobile">
                <div class="dbd-card-mobile-head">
                  <span class="dbd-card-mobile-name">Total</span>
                </div>
                <div class="dbd-cell-strong">{{ formatSoles(b.netAmount) }}</div>
              </div>
            </div>
          }
        } @else {
          @if (loadingCustomers()) {
            <div class="dbd-skeleton" role="status" aria-label="Cargando mapa"></div>
          } @else {
            <app-batch-map [customers]="customers()" />
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .dbd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .dbd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .dbd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 6px 0 4px;
        color: var(--ink);
      }
      .dbd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .dbd-actions {
        display: flex;
        gap: 10px;
      }
      .dbd-hint {
        margin: 14px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .dbd-hint-alert {
        color: var(--accent-ink);
        font-weight: 600;
      }
      .dbd-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      .dbd-metric {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .dbd-metric-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .dbd-metric-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .dbd-tabs {
        display: flex;
        gap: 0;
        margin-top: 28px;
        border-bottom: var(--border-rule);
      }
      .dbd-tab {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 14px;
        padding: 12px 18px;
        color: var(--ink-muted);
        border-bottom: 3px solid transparent;
      }
      .dbd-tab.on {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .dbd-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 16px 0;
      }
      .dbd-filters ui-field {
        width: 220px;
      }
      .dbd-cell-strong {
        font-weight: 800;
      }
      .dbd-invoice-link {
        font-weight: 800;
        color: var(--accent);
        text-decoration: none;
      }
      .dbd-invoice-link:hover {
        text-decoration: underline;
      }
      .dbd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .dbd-attended-time {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .dbd-item-struck {
        text-decoration: line-through;
        text-decoration-color: var(--accent-ink);
        margin-right: 4px;
      }
      .dbd-row-action {
        text-align: right;
      }
      .dbd-team-row {
        cursor: pointer;
      }
      .dbd-team-row:hover {
        background: var(--faint);
      }
      .dbd-team-row-dim {
        opacity: 0.65;
      }
      .dbd-team-row-total td {
        font-weight: 800;
        border-top: var(--border-rule);
      }
      .dbd-card-mobile-click {
        cursor: pointer;
      }
      .dbd-card-mobile-click:hover {
        background: var(--faint);
      }
      .dbd-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .dbd-page {
          padding: var(--sp-4);
        }
        .dbd-table-desktop {
          display: none;
        }
        .dbd-cards-mobile {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }
        .dbd-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .dbd-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .dbd-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .dbd-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class DeliveryBatchDetailPage {
  private deliverySvc = inject(DeliveryAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  id = input('');

  protected canViewInvoice = computed(() => this.auth.hasAny('customer.view', 'invoice.reconcile'));
  protected canAssignTeam = computed(() => this.auth.hasAny('delivery.settle'));

  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected timeText = timeText;
  protected formatSoles = formatSoles;
  protected statusName = batchStatusName;
  protected itemStatusText = itemStatusName;
  protected roleInTeamName = roleInTeamName;
  protected itemStatusOptions = ITEM_STATUS_FILTER_OPTIONS;

  protected batch = signal<BatchDetail | null>(null);
  protected customers = signal<BatchCustomerView[]>([]);
  protected loading = signal(true);
  protected loadingCustomers = signal(true);
  protected error = signal(false);
  protected settling = signal(false);
  protected view = signal<'items' | 'team' | 'map'>('items');
  protected itemStatusFilter = signal('');
  /** '' = todos, UNATTENDED_FILTER_VALUE = sin atender, o el registeredByUserId como texto. */
  protected attendedByFilter = signal('');

  protected pendingCount = computed(
    () => this.batch()?.items.filter((i) => i.statusCode === 'PENDING').length ?? 0,
  );

  /** Cantidad de comprobantes pendientes — lo mismo que `pendingCount`, con el nombre que usa la pestaña Equipo. */
  protected unattendedCount = this.pendingCount;

  /** Se resuelve en el panel sobre los items ya cargados — sección 10.2. */
  protected attendedByOptions = computed<UiFieldOption[]>(() => {
    const items = this.batch()?.items ?? [];
    const byId = new Map<number, string>();
    for (const i of items) {
      if (i.registeredByUserId != null && i.registeredByName) {
        byId.set(i.registeredByUserId, i.registeredByName);
      }
    }
    return [
      { value: '', label: 'Todos' },
      ...Array.from(byId, ([id, name]) => ({ value: String(id), label: name })),
      { value: UNATTENDED_FILTER_VALUE, label: 'Sin atender' },
    ];
  });

  protected filteredItems = computed(() => {
    const items = this.batch()?.items ?? [];
    const statusFilter = this.itemStatusFilter();
    const attendedFilter = this.attendedByFilter();
    return items.filter((i) => {
      if (statusFilter && i.statusCode !== statusFilter) return false;
      if (attendedFilter === UNATTENDED_FILTER_VALUE) return i.registeredByUserId == null;
      if (attendedFilter && String(i.registeredByUserId) !== attendedFilter) return false;
      return true;
    });
  });

  /**
   * El backend a veces no manda itemsProgressPercentage (queda undefined);
   * en ese caso se calcula acá desde los comprobantes — los que ya no están
   * pendientes sobre el total.
   */
  protected pct(b: BatchDetail): number {
    if (Number.isFinite(b.itemsProgressPercentage)) return Math.round(b.itemsProgressPercentage);
    if (!b.items.length) return 0;
    const resolved = b.items.length - this.pendingCount();
    return Math.round((resolved / b.items.length) * 100);
  }

  // Bug real detrás de "el mapa no renderiza": los inputs ligados a la ruta
  // (withComponentInputBinding) todavía no tienen valor en el constructor —
  // Angular los setea después de instanciar el componente. Cargar ahí
  // siempre pedía id=0 y `load()` abortaba en silencio. Con `effect` se
  // dispara apenas el router setea el id real (y de nuevo si cambia).
  private loadEffect = effect(() => {
    if (this.id()) this.load();
  });

  protected canSettle(b: BatchDetail): boolean {
    return b.statusCode !== 'SETTLED' && this.pendingCount() === 0;
  }

  load() {
    const id = Number(this.id());
    if (!id) return;
    this.loading.set(true);
    this.loadingCustomers.set(true);
    this.error.set(false);
    forkJoin({
      batch: this.deliverySvc.batchDetail(id),
      customers: this.deliverySvc.batchCustomers(id),
    }).subscribe({
      next: ({ batch, customers }) => {
        this.batch.set(batch);
        this.customers.set(customers);
        this.loading.set(false);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingCustomers.set(false);
        this.error.set(true);
      },
    });
  }

  protected openAssignTeam(b: BatchDetail) {
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

  protected settle(b: BatchDetail) {
    this.dialog
      .confirm({
        title: 'Liquidar planilla',
        message: `¿Liquidar la planilla ${b.series}-${b.number}? Esta acción no se puede deshacer.`,
        confirmLabel: 'Liquidar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.settling.set(true);
        this.deliverySvc.settle(b.batchId).subscribe({
          next: () => {
            this.settling.set(false);
            this.toast.success('Planilla liquidada.');
            this.load();
          },
          error: () => this.settling.set(false),
        });
      });
  }

  protected viewReturns(item: { invoiceId: string; customerName: string }) {
    this.dialog.open(ReturnsDialog, {
      data: { invoiceId: item.invoiceId, customerName: item.customerName },
      width: '480px',
    });
  }

  /** Clic en un integrante de Equipo → Comprobantes filtrado por esa persona — sección 9.4. */
  protected openMember(m: MemberTotals) {
    this.itemStatusFilter.set('');
    this.attendedByFilter.set(String(m.userId));
    this.view.set('items');
  }

  /** Clic en "Sin atender" → Comprobantes filtrado por estado Pendiente — sección 9.4. */
  protected openUnattended() {
    this.attendedByFilter.set('');
    this.itemStatusFilter.set('PENDING');
    this.view.set('items');
  }
}
