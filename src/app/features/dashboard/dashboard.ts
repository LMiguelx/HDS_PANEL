import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiButton } from '../../shared/ui/button/button';
import { DashboardAdminService } from './dashboard-admin';
import {
  DashboardCustomersView,
  DashboardDeliverySummaryView,
  DashboardOrdersSummaryView,
  DashboardPendingView,
  DashboardTodayView,
  TopProductView,
  TopSalespersonView,
} from '../../shared/models/dashboard.models';
import { BATCH_STATUS_COLOR_VAR, BATCH_STATUS_OPTIONS } from '../delivery/delivery-format';
import { LookupService } from '../promos/lookup';
import { formatSoles } from '../../shared/pipes/money';

const TOP_LIMIT_OPTIONS: UiFieldOption[] = [
  { value: '3', label: 'Top 3' },
  { value: '5', label: 'Top 5' },
  { value: '7', label: 'Top 7' },
];

const PENDING_POLL_MS = 5 * 60_000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ROLE_AVATAR_COLORS = [
  'var(--accent)',
  'var(--st-in-route)',
  'var(--status-ok)',
  'var(--st-matched-manual)',
];

const ORDER_STATUS_TONE_VAR: Record<string, string> = {
  OPEN: '--status-warn',
  SENT_TO_BILLING: '--accent',
  COUNTER_DELIVERED: '--success',
  CANCELLED: '--ink-muted',
};

interface PendingCardVM {
  key: string;
  label: string;
  value: number;
  detail: string;
  tone: 'accent' | 'warn' | 'danger';
  route: string[] | null;
  queryParams?: Record<string, string>;
}

/**
 * Home — doc 66. Pendientes de gestión (nuevo), Pedidos del día y Clientes
 * del día rehechos, En jornada hoy (antes "Usuarios activos hoy"), Reparto y
 * Mejores ventas/Producto en mejor movimiento sin cambios de contenido.
 * Todo desde `GET /api/admin/dashboard/today` + `GET /.../pending`
 * (`report.view`), en paralelo. Ya no hay tiles de navegación: todos los
 * módulos viven en el navbar.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, UiField, UiEmpty, UiButton],
  template: `
    <section class="home-page">
      <div class="home-head">
        <div>
          <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
          <p class="home-sub">Resumen del día de un vistazo.</p>
        </div>
        @if (showDashboard()) {
          <div class="home-toolbar">
            <ui-field label="Fecha" type="date" [(value)]="date" />
            @if (canGoToReparto()) {
              <button
                uiButton
                variant="secondary"
                routerLink="/inicio-reparto"
                class="home-reparto-link"
              >
                Ir al reparto del día
              </button>
            }
          </div>
        }
      </div>

      @if (showDashboard()) {
        <!-- Pendientes de gestión -->
        <div class="home-block">
          <div class="home-block-head">
            <h2 class="home-block-title">Pendientes de gestión</h2>
            <div class="home-pending-toolbar">
              <span class="home-pending-flag">a hoy</span>
              @if (pendingUpdatedAt(); as u) {
                <span class="home-pending-updated"
                  >Actualizado
                  {{ u.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }}</span
                >
              }
              <button
                uiButton
                variant="ghost"
                size="sm"
                [loading]="pendingLoading()"
                (click)="loadPending()"
              >
                <span class="material-icons" aria-hidden="true">refresh</span>
                Actualizar
              </button>
            </div>
          </div>

          @if (pendingLoading() && !pendingData()) {
            <div class="home-pending-skeleton" role="status" aria-label="Cargando"></div>
          } @else if (pendingError() && !pendingData()) {
            <ui-empty
              variant="error"
              title="No pudimos cargar los pendientes de gestión"
              actionLabel="Reintentar"
              (action)="loadPending()"
            />
          } @else {
            <div class="home-pending-grid">
              @for (card of pendingCards(); track card.key) {
                <a
                  class="home-pending-card"
                  [class.home-pending-disabled]="!card.route"
                  [class.home-pending-accent]="card.value > 0 && card.tone === 'accent'"
                  [class.home-pending-warn]="card.value > 0 && card.tone === 'warn'"
                  [class.home-pending-danger]="card.value > 0 && card.tone === 'danger'"
                  [routerLink]="card.route"
                  [queryParams]="card.queryParams ?? null"
                  [attr.tabindex]="card.route ? 0 : -1"
                >
                  <span class="home-pending-value">{{ card.value }}</span>
                  <span class="home-pending-label">{{ card.label }}</span>
                  <span class="home-pending-detail">{{
                    card.value === 0 ? 'Al día' : card.detail
                  }}</span>
                </a>
              }
            </div>
          }
        </div>

        @if (loading()) {
          <div class="home-dash-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el resumen del día"
            body="Intenta de nuevo en unos segundos."
            actionLabel="Reintentar"
            (action)="load()"
          />
        } @else if (data(); as d) {
          <!-- Pedidos del día -->
          <div class="home-block">
            <h2 class="home-block-title">Pedidos del día</h2>
            <p class="home-block-sub">{{ d.date }} · sin contar anulados</p>

            <div class="home-orders-grid">
              <div class="home-orders-summary">
                <a class="home-orders-total" routerLink="/pedidos" [queryParams]="dayParams()">
                  <span class="home-orders-total-value">{{ d.orders.totalOrders }}</span>
                  <span class="home-orders-total-label">pedidos</span>
                </a>
                <div class="home-orders-net">
                  <span class="home-orders-net-value">{{ formatSoles(d.orders.netAmount) }}</span>
                  <span class="home-orders-net-label">neto</span>
                </div>
                <p class="home-orders-gross">Bruto {{ formatSoles(d.orders.totalAmount) }}</p>

                <div class="home-brand-box">
                  <span class="home-brand-label">Marca más vendida</span>
                  @if (d.orders.topBrandName) {
                    <span class="home-brand-name" [title]="d.orders.topBrandName">{{
                      d.orders.topBrandName
                    }}</span>
                    <span class="home-brand-amount">{{
                      formatSoles(d.orders.topBrandAmount!)
                    }}</span>
                  } @else {
                    <span class="home-brand-name home-muted">—</span>
                  }
                </div>
              </div>

              <div class="home-orders-status">
                <span class="home-orders-col-title">Por estado</span>
                <div class="home-status-bar">
                  @for (s of d.orders.byStatus; track s.statusCode) {
                    @if (s.count > 0) {
                      <span
                        class="home-status-bar-seg"
                        [style.width.%]="statusBarPct(d.orders, s)"
                        [style.background]="'var(' + statusTone(s.statusCode) + ')'"
                      ></span>
                    }
                  }
                </div>
                <div class="home-status-legend">
                  @for (s of d.orders.byStatus; track s.statusCode) {
                    <a
                      class="home-legend-row"
                      [class.home-legend-disabled]="!canSeeOrders()"
                      [routerLink]="canSeeOrders() ? ['/pedidos'] : null"
                      [queryParams]="orderStatusParams(s.statusCode)"
                    >
                      <span
                        class="home-legend-dot"
                        [style.background]="'var(' + statusTone(s.statusCode) + ')'"
                      ></span>
                      <span class="home-legend-name">{{ s.statusName }}</span>
                      <span class="home-legend-value">{{ s.count }}</span>
                      @if (s.statusCode !== 'CANCELLED') {
                        <span class="home-legend-amount">{{ formatSoles(s.netAmount) }}</span>
                      }
                    </a>
                  }
                </div>

                @if (erpFacturadosLine(d.orders); as erp) {
                  <div class="home-erp-line">
                    <div class="home-erp-head">
                      <span>Facturados por el ERP</span>
                      <span>{{ erp.uploaded }} de {{ erp.sent }} enviados</span>
                    </div>
                    <div class="home-erp-track">
                      <div class="home-erp-fill" [style.width.%]="erp.pct"></div>
                    </div>
                  </div>
                }
              </div>

              <div class="home-orders-side">
                <div class="home-orders-origin">
                  <span class="home-orders-col-title">Por origen</span>
                  <div class="home-origin-list">
                    @for (o of visibleOrigins(d.orders); track o.originCode) {
                      <a
                        class="home-origin-row"
                        [class.home-legend-disabled]="!canSeeOrders()"
                        [routerLink]="canSeeOrders() ? ['/pedidos'] : null"
                        [queryParams]="orderOriginParams(o.originCode)"
                      >
                        <span class="home-origin-name">{{ o.originName }}</span>
                        <div class="home-origin-track">
                          <div
                            class="home-origin-fill"
                            [style.width.%]="originBarPct(d.orders, o.count)"
                          ></div>
                        </div>
                        <span class="home-origin-value">{{ o.count }}</span>
                      </a>
                    }
                  </div>
                </div>

                <div class="home-bonus-box">
                  <span class="home-orders-col-title">Bonificaciones</span>
                  <p class="home-bonus-line">
                    {{ d.orders.totalBonusLines }} línea{{
                      d.orders.totalBonusLines === 1 ? '' : 's'
                    }}
                    · {{ d.orders.totalBonusUnits }} u.
                  </p>
                  @if (d.orders.pendingStockBonusLines > 0) {
                    <a
                      class="home-bonus-warn"
                      [class.home-legend-disabled]="!canManageBonusTray()"
                      [routerLink]="
                        canManageBonusTray() ? ['/pedidos/bonificaciones-sin-stock'] : null
                      "
                    >
                      ⚠ {{ d.orders.pendingStockBonusLines }} sin stock ({{
                        d.orders.pendingStockBonusUnits
                      }}
                      u.)
                    </a>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Clientes del día + En jornada hoy -->
          <div class="home-side-grid">
            <a
              class="home-block home-customers-block"
              [class.home-block-disabled]="!canSeeAssignments()"
              [routerLink]="canSeeAssignments() ? ['/asignaciones/mapa'] : null"
              [queryParams]="{ date: d.customers.date }"
            >
              <h2 class="home-block-title">Clientes del día</h2>
              @if (d.customers.scheduled === 0) {
                <p class="home-block-empty">No hay clientes programados para esta fecha</p>
              } @else {
                <p class="home-customers-scheduled">{{ d.customers.scheduled }} programados</p>
                <div class="home-customers-bar">
                  <div
                    class="home-customers-bar-fill"
                    [style.width.%]="d.customers.visitPercentage"
                  ></div>
                </div>
                <p class="home-customers-bar-label">{{ d.customers.visitPercentage }}% visitados</p>
                <div class="home-customers-breakdown">
                  <span class="home-customers-ok"
                    >Con pedido {{ d.customers.ordered }} ({{ d.customers.orderPercentage }}%)</span
                  >
                  <span class="home-customers-warn">Sin compra {{ d.customers.noOrder }}</span>
                  <span class="home-customers-muted">Cerrados {{ d.customers.closed }}</span>
                  <span class="home-customers-neutral">Pendientes {{ d.customers.pending }}</span>
                </div>
              }
            </a>

            <div class="home-block">
              <h2 class="home-block-title">En jornada hoy</h2>
              <p class="home-block-sub">Abrieron jornada en la fecha · clic para ver en Usuarios</p>
              @if (d.activeUsers.byRole.length === 0) {
                <p class="home-block-empty">Nadie abrió jornada en esta fecha</p>
              } @else {
                <div class="home-roles-grid">
                  @for (r of d.activeUsers.byRole; track r.roleCode; let i = $index) {
                    <a
                      class="home-role-card"
                      [class.home-role-disabled]="!canManageUsers()"
                      [routerLink]="canManageUsers() ? ['/usuarios'] : null"
                      [queryParams]="{ roleCode: r.roleCode, onRouteToday: 'true' }"
                    >
                      <span class="home-role-avatar" [style.background]="roleColor(i)">{{
                        r.roleName.charAt(0)
                      }}</span>
                      <span class="home-role-count">{{ r.activeCount }}</span>
                      <span class="home-role-name">{{ r.roleName }}</span>
                    </a>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Reparto -->
          <div class="home-block home-block-compact">
            <h2 class="home-block-title">Reparto</h2>
            <div class="home-reparto-grid">
              <div class="home-reparto-bars">
                <div class="home-amount-row">
                  <span class="home-amount-label">Monto definido</span>
                  <div class="home-amount-track">
                    <div
                      class="home-amount-fill"
                      style="width: 100%; background: var(--st-open)"
                    ></div>
                  </div>
                  <span class="home-amount-value">{{ formatSoles(d.delivery.totalAmount) }}</span>
                </div>
                <div class="home-amount-row">
                  <span class="home-amount-label">Devoluciones</span>
                  <div class="home-amount-track">
                    <div
                      class="home-amount-fill"
                      [style.width.%]="amountPct(d.delivery.returnedAmount, d.delivery.totalAmount)"
                      style="background: var(--status-danger)"
                    ></div>
                  </div>
                  <span class="home-amount-value">{{
                    formatSoles(d.delivery.returnedAmount)
                  }}</span>
                </div>
                <div class="home-amount-row">
                  <span class="home-amount-label">Monto neto</span>
                  <div class="home-amount-track">
                    <div
                      class="home-amount-fill"
                      [style.width.%]="amountPct(d.delivery.netAmount, d.delivery.totalAmount)"
                      style="background: var(--status-ok)"
                    ></div>
                  </div>
                  <span class="home-amount-value">{{ formatSoles(d.delivery.netAmount) }}</span>
                </div>

                <div class="home-progress">
                  <div class="home-progress-head">
                    <span>Avance de comprobantes</span>
                    <span class="home-progress-pct">{{ deliveryProgressPct(d.delivery) }}%</span>
                  </div>
                  <div class="home-progress-track">
                    <div
                      class="home-progress-fill"
                      [style.width.%]="deliveryProgressPct(d.delivery)"
                    ></div>
                  </div>
                  <span class="home-progress-note"
                    >{{ d.delivery.totalItems - d.delivery.itemStatusCounts.pending }} de
                    {{ d.delivery.totalItems }} comprobantes conciliados</span
                  >
                </div>
              </div>

              <div class="home-donut-wrap">
                <span class="home-donut-title">Planillas por estado</span>
                <div class="home-donut" [style.background]="donutGradient(d.delivery)">
                  <div class="home-donut-hole">
                    <span class="home-donut-value">{{ d.delivery.totalBatches }}</span>
                    <span class="home-donut-label">planillas</span>
                  </div>
                </div>
                <div class="home-donut-legend">
                  @for (row of batchStatusSegments(d.delivery); track row.code) {
                    @if (row.count > 0) {
                      <a
                        class="home-legend-row"
                        routerLink="/reparto"
                        [queryParams]="{ estado: row.code }"
                      >
                        <span class="home-legend-dot" [style.background]="row.colorVar"></span>
                        <span class="home-legend-name">{{ row.name }}</span>
                        <span class="home-legend-value">{{ row.count }} · {{ row.pct }}%</span>
                      </a>
                    }
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Mejores ventas + Producto en mejor movimiento -->
          <div class="home-double-grid">
            <div class="home-block">
              <div class="home-block-head">
                <h2 class="home-block-title">Mejores ventas del día</h2>
                <div class="home-block-controls">
                  <ui-field
                    label="Top"
                    type="select"
                    [(value)]="topLimitStr"
                    [options]="topLimitOptions"
                  />
                  <ui-field
                    label="Canal"
                    type="select"
                    [(value)]="topChannelIdStr"
                    [options]="channelOptions()"
                  />
                </div>
              </div>
              @if (topLoading()) {
                <div class="home-top-skeleton" role="status" aria-label="Cargando"></div>
              } @else if (displayedTopSalespeople().length === 0) {
                <p class="home-block-empty">{{ topEmptyText() }}</p>
              } @else {
                <ol class="home-rank-list">
                  @for (s of displayedTopSalespeople(); track s.userId; let i = $index) {
                    <li class="home-rank-row">
                      <span class="home-rank-num">{{ i + 1 }}</span>
                      <span class="home-rank-body">
                        <span class="home-rank-name">{{ s.fullName }}</span>
                        <span class="home-rank-meta"
                          >{{ s.branchName || '—'
                          }}{{ topChannelIdStr() ? '' : ' · ' + s.salesChannelName }}</span
                        >
                      </span>
                      <span class="home-rank-amount">{{ formatSoles(s.netAmount) }}</span>
                    </li>
                  }
                </ol>
              }
            </div>

            <div class="home-block">
              <h2 class="home-block-title">Producto en mejor movimiento</h2>
              @if (d.topProducts.length === 0) {
                <p class="home-block-empty">Todavía no hay unidades despachadas hoy.</p>
              } @else {
                <div class="home-product-bars">
                  @for (p of d.topProducts; track p.productId) {
                    <div class="home-product-row">
                      <span class="home-product-name">{{ p.productName }}</span>
                      <div class="home-product-track">
                        <div
                          class="home-product-fill"
                          [style.width.%]="productBarPct(d.topProducts, p.totalQuantity)"
                        ></div>
                      </div>
                      <span class="home-product-value">{{ p.totalQuantity }} u.</span>
                    </div>
                  }
                </div>
                <p class="home-block-note">Unidades despachadas hoy.</p>
              }
            </div>
          </div>

          <p class="home-dash-footer">Datos al {{ d.date }}.</p>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        font-family: var(--font-sans);
        color: var(--ink);
      }
      .home-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .home-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
      }
      .home-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 420px;
      }

      .home-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
      }
      .home-toolbar ui-field {
        max-width: 180px;
      }
      .home-reparto-link {
        white-space: nowrap;
      }
      .home-dash-skeleton {
        height: 320px;
        background: var(--faint);
        margin-top: 18px;
      }
      .home-dash-footer {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-muted {
        color: var(--ink-muted);
      }

      .home-block {
        border: 1px solid var(--hairline);
        padding: 18px 20px;
        margin-top: 18px;
        display: block;
        color: inherit;
        text-decoration: none;
      }
      .home-block-compact {
        padding: 14px 20px;
      }
      .home-block-disabled {
        cursor: default;
      }
      .home-block-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .home-block-sub {
        margin: 0 0 14px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-block-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .home-block-head .home-block-title {
        margin: 0;
      }
      .home-block-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .home-block-controls ui-field {
        width: 96px;
      }
      .home-top-skeleton {
        height: 140px;
        background: var(--faint);
      }
      .home-block-empty {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .home-block-note {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }

      /* — Pendientes de gestión — */
      .home-pending-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .home-pending-flag {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        border: 1px solid var(--hairline);
        padding: 3px 8px;
      }
      .home-pending-updated {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-pending-skeleton {
        height: 160px;
        background: var(--faint);
        margin-top: 4px;
      }
      .home-pending-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(170px, 100%), 1fr));
        gap: 12px;
        margin-top: 4px;
      }
      .home-pending-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border: 1px solid var(--hairline);
        border-left: 3px solid var(--hairline);
        padding: 12px 14px;
        text-decoration: none;
        color: inherit;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      a.home-pending-card:hover {
        border-color: var(--ink-muted);
      }
      .home-pending-disabled {
        cursor: default;
      }
      .home-pending-disabled:hover {
        border-color: var(--hairline);
      }
      .home-pending-accent {
        border-left-color: var(--accent);
      }
      .home-pending-warn {
        border-left-color: var(--status-warn);
      }
      .home-pending-danger {
        border-left-color: var(--status-danger);
      }
      .home-pending-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-pending-accent .home-pending-value {
        color: var(--accent-ink);
      }
      .home-pending-warn .home-pending-value {
        color: var(--status-warn);
      }
      .home-pending-danger .home-pending-value {
        color: var(--status-danger);
      }
      .home-pending-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink);
      }
      .home-pending-detail {
        font-size: 11px;
        color: var(--ink-muted);
      }

      /* — Pedidos del día — */
      .home-orders-grid {
        display: grid;
        grid-template-columns: 1fr 1.3fr 1fr;
        gap: 28px;
      }
      .home-orders-summary {
        display: grid;
        gap: 2px;
        align-content: start;
      }
      .home-orders-total {
        display: flex;
        align-items: baseline;
        gap: 6px;
        text-decoration: none;
        color: inherit;
      }
      .home-orders-total-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-orders-total-label {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .home-orders-net {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-top: 6px;
      }
      .home-orders-net-value {
        font-size: 22px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-orders-net-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-orders-gross {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-brand-box {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px dashed var(--hairline);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .home-brand-label {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .home-brand-name {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 220px;
      }
      .home-brand-amount {
        font-size: 12px;
        color: var(--ink-muted);
      }

      .home-orders-col-title {
        display: block;
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 8px;
      }
      .home-status-bar {
        display: flex;
        height: 10px;
        width: 100%;
        background: var(--faint);
        overflow: hidden;
      }
      .home-status-bar-seg {
        height: 100%;
      }
      .home-status-legend {
        margin-top: 10px;
        display: grid;
        gap: 2px;
      }
      .home-erp-line {
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px dashed var(--hairline);
      }
      .home-erp-head {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--ink);
        margin-bottom: 4px;
      }
      .home-erp-track {
        height: 6px;
        background: var(--faint);
      }
      .home-erp-fill {
        height: 100%;
        background: var(--accent);
      }

      .home-orders-side {
        display: grid;
        gap: 18px;
        align-content: start;
      }
      .home-origin-list {
        display: grid;
        gap: 8px;
      }
      .home-origin-row {
        display: grid;
        grid-template-columns: 76px 1fr 28px;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: inherit;
        font-size: 12px;
      }
      .home-origin-name {
        color: var(--ink-muted);
      }
      .home-origin-track {
        height: 8px;
        background: var(--faint);
      }
      .home-origin-fill {
        height: 100%;
        background: var(--st-in-route);
      }
      .home-origin-value {
        font-weight: 800;
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .home-bonus-box {
        border-top: 1px dashed var(--hairline);
        padding-top: 12px;
      }
      .home-bonus-line {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }
      .home-bonus-warn {
        display: inline-block;
        margin-top: 6px;
        font-size: 12px;
        font-weight: 700;
        color: var(--status-warn);
        text-decoration: none;
      }
      .home-legend-disabled,
      .home-role-disabled,
      a.home-block-disabled {
        pointer-events: none;
      }

      /* — Clientes del día / En jornada hoy — */
      .home-side-grid {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 18px;
        margin-top: 18px;
      }
      .home-side-grid .home-block {
        margin-top: 0;
      }
      .home-customers-block:hover {
        border-color: var(--accent);
      }
      .home-customers-scheduled {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        color: var(--ink);
      }
      .home-customers-bar {
        margin-top: 10px;
        height: 12px;
        background: var(--faint);
      }
      .home-customers-bar-fill {
        height: 100%;
        background: var(--accent);
      }
      .home-customers-bar-label {
        margin: 4px 0 0;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink);
      }
      .home-customers-breakdown {
        margin-top: 12px;
        display: grid;
        gap: 4px;
        font-size: 12px;
      }
      .home-customers-ok {
        color: var(--success);
        font-weight: 700;
      }
      .home-customers-warn {
        color: var(--status-warn);
      }
      .home-customers-muted {
        color: var(--ink-muted);
      }
      .home-customers-neutral {
        color: var(--ink);
      }

      /* — Bloque usuarios activos — */
      .home-roles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr));
        gap: 12px;
      }
      .home-role-card {
        border: 1px solid var(--hairline);
        padding: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
        text-decoration: none;
        color: inherit;
      }
      a.home-role-card:hover {
        border-color: var(--accent);
      }
      .home-role-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--on-accent);
        font-weight: 800;
      }
      .home-role-count {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-role-name {
        font-size: 12px;
        color: var(--ink-muted);
      }

      /* — Reparto — */
      .home-reparto-grid {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 28px;
      }
      .home-reparto-bars {
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .home-amount-row {
        display: grid;
        grid-template-columns: 110px 1fr auto;
        align-items: center;
        gap: 12px;
      }
      .home-amount-label {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .home-amount-track {
        height: 10px;
        background: var(--faint);
      }
      .home-amount-fill {
        height: 100%;
        transition: width var(--dur-base) var(--ease-standard);
      }
      .home-amount-value {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .home-progress {
        margin-top: 2px;
      }
      .home-progress-head {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--ink);
        margin-bottom: 6px;
      }
      .home-progress-pct {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .home-progress-track {
        height: 10px;
        background: var(--faint);
      }
      .home-progress-fill {
        height: 100%;
        background: var(--status-ok);
        transition: width var(--dur-base) var(--ease-standard);
      }
      .home-progress-note {
        display: block;
        margin-top: 6px;
        font-size: 12px;
        color: var(--ink-muted);
      }

      .home-donut-wrap {
        display: grid;
        gap: 10px;
        align-content: start;
        justify-items: center;
      }
      .home-donut-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .home-donut {
        width: 108px;
        height: 108px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .home-donut-hole {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .home-donut-value {
        font-size: 18px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-donut-label {
        font-size: 10px;
        color: var(--ink-muted);
      }
      .home-donut-legend {
        display: grid;
        gap: 4px;
        width: 100%;
      }
      .home-legend-row {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: var(--ink);
        font-size: 12px;
        padding: 3px 4px;
      }
      .home-legend-row:hover {
        background: var(--faint);
      }
      .home-legend-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .home-legend-name {
        flex: 1;
        color: var(--ink-muted);
      }
      .home-legend-value {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .home-legend-amount {
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      /* — Mejores ventas / Producto — */
      .home-double-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 18px;
        margin-top: 18px;
      }
      .home-double-grid .home-block {
        margin-top: 0;
      }

      .home-rank-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .home-rank-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg);
        padding: 8px 10px;
      }
      .home-rank-num {
        font-size: 12px;
        font-weight: 800;
        color: var(--ink-muted);
        width: 16px;
      }
      .home-rank-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .home-rank-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .home-rank-meta {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .home-rank-amount {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }

      .home-product-bars {
        display: grid;
        gap: 10px;
      }
      .home-product-row {
        display: grid;
        grid-template-columns: 84px 1fr 44px;
        align-items: center;
        gap: 10px;
      }
      .home-product-name {
        font-size: 12px;
        color: var(--ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .home-product-track {
        height: 14px;
        background: var(--faint);
      }
      .home-product-fill {
        height: 100%;
        background: var(--st-in-route);
        transition: width var(--dur-base) var(--ease-standard);
      }
      .home-product-value {
        font-size: 12px;
        font-weight: 800;
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 1200px) {
        .home-orders-grid {
          grid-template-columns: 1fr 1fr;
        }
        .home-orders-side {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 1100px) {
        .home-double-grid {
          grid-template-columns: 1fr;
        }
        .home-side-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 900px) {
        .home-reparto-grid {
          grid-template-columns: 1fr;
        }
        .home-orders-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .home-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class DashboardPage {
  private auth = inject(AuthService);
  private dashboardSvc = inject(DashboardAdminService);
  private lookupSvc = inject(LookupService);

  readonly user = this.auth.currentUser;

  protected formatSoles = formatSoles;
  protected showDashboard = computed(() => this.auth.hasAny('report.view'));
  /** Doc 50, sección 5.1: también tiene reparto (p. ej. el Administrador) — acceso directo a su inicio. */
  protected canGoToReparto = computed(() => this.auth.hasAny('delivery.manage'));
  protected canSeeOrders = computed(() =>
    this.auth.hasAny('order.view_all', 'order.create', 'order.manage'),
  );
  protected canSeeAssignments = computed(() => this.auth.hasAny('customer.assign'));
  protected canManageUsers = computed(() => this.auth.hasAny('user.manage'));
  protected canApproveCustomers = computed(() => this.auth.hasAny('customer.approve'));
  protected canManageBonusTray = computed(() => this.auth.hasAny('order.manage'));
  protected canSendToBilling = computed(() => this.auth.hasAny('order.send_to_billing'));

  protected date = signal(todayIso());
  protected data = signal<DashboardTodayView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  // — Pendientes de gestión — doc 66, sección 3.2 —
  protected pendingData = signal<DashboardPendingView | null>(null);
  protected pendingLoading = signal(true);
  protected pendingError = signal(false);
  protected pendingUpdatedAt = signal<Date | null>(null);

  protected pendingCards = computed<PendingCardVM[]>(() => {
    const p = this.pendingData();
    if (!p) return [];
    const approve = this.canApproveCustomers();
    const assign = this.canSeeAssignments();
    const bonusTray = this.canManageBonusTray();
    const billing = this.canSendToBilling();
    return [
      {
        key: 'creation',
        label: 'Creación de clientes',
        value: p.creationRequests.pending,
        detail: `${p.creationRequests.readyToApprove} lista${p.creationRequests.readyToApprove === 1 ? '' : 's'} para aprobar`,
        tone: 'accent',
        route: approve ? ['/aprobaciones'] : null,
        queryParams: { tab: 'creation' },
      },
      {
        key: 'field-change',
        label: 'Edición de clientes',
        value: p.fieldChangeRequests.pending,
        detail: `${p.fieldChangeRequests.readyToApprove} lista${p.fieldChangeRequests.readyToApprove === 1 ? '' : 's'}`,
        tone: 'accent',
        route: approve ? ['/aprobaciones'] : null,
        queryParams: { tab: 'field-change' },
      },
      {
        key: 'closure',
        label: 'Cierre de clientes',
        value: p.closureRequests.pending,
        detail: `${p.closureRequests.readyToApprove} listo${p.closureRequests.readyToApprove === 1 ? '' : 's'}`,
        tone: 'accent',
        route: approve ? ['/aprobaciones'] : null,
        queryParams: { tab: 'closure' },
      },
      {
        key: 'incomplete-schedules',
        label: 'Horario incompleto',
        value: p.incompleteSchedules,
        detail: 'asignaciones sin días o semanas',
        tone: 'warn',
        route: assign ? ['/asignaciones/pendientes'] : null,
      },
      {
        key: 'orphan-customers',
        label: 'Sin vendedor',
        value: p.orphanCustomers,
        detail: 'clientes activos',
        tone: 'warn',
        route: assign ? ['/asignaciones/huerfanos'] : null,
      },
      {
        key: 'pending-stock-bonus',
        label: 'Bonificaciones sin stock',
        value: p.pendingStockBonusOrders,
        detail: 'pedidos abiertos',
        tone: 'warn',
        route: bonusTray ? ['/pedidos/bonificaciones-sin-stock'] : null,
      },
      {
        key: 'negative-stock',
        label: 'Negativos hoy',
        value: p.negativeStockProducts,
        detail: 'productos',
        tone: 'danger',
        route: billing ? ['/validacion-facturacion'] : null,
      },
    ];
  });

  // — tarjeta "Mejores ventas del día" —
  protected topLimitOptions = TOP_LIMIT_OPTIONS;
  protected channelOptions = signal<UiFieldOption[]>([{ value: '', label: 'Todos' }]);
  protected topLimitStr = signal('5');
  protected topChannelIdStr = signal('');
  protected topSalespeopleOverride = signal<TopSalespersonView[] | null>(null);
  protected topLoading = signal(false);

  protected displayedTopSalespeople = computed(
    () => this.topSalespeopleOverride() ?? this.data()?.topSalespeople ?? [],
  );
  protected topEmptyText = computed(() =>
    this.topChannelIdStr()
      ? 'Sin ventas en este canal para el día.'
      : 'Todavía no hay ventas registradas hoy.',
  );

  protected dayParams = computed(() => ({ from: this.date(), to: this.date() }));

  private loadEffect = effect(() => {
    this.date();
    untracked(() => {
      if (this.showDashboard()) this.load();
    });
  });

  /**
   * Solo se dispara al cambiar el selector de cantidad o canal — nunca
   * recarga /today. Si vuelve a los valores por defecto (Top 5, Todos) usa
   * directamente d.topSalespeople, sin llamar al endpoint.
   */
  private topSelectorsEffect = effect(() => {
    const limitStr = this.topLimitStr();
    const channelStr = this.topChannelIdStr();
    untracked(() => {
      if (!this.data()) return;
      if (limitStr === '5' && channelStr === '') {
        this.topSalespeopleOverride.set(null);
        return;
      }
      this.loadTopSalespeople(Number(limitStr), channelStr ? Number(channelStr) : undefined);
    });
  });

  constructor() {
    this.lookupSvc.salesChannels().subscribe((items) => {
      this.channelOptions.set([
        { value: '', label: 'Todos' },
        ...items.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });

    if (this.showDashboard()) {
      this.loadPending();
      const handle = setInterval(() => this.loadPending(), PENDING_POLL_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(handle));
    }
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.dashboardSvc.today(this.date()).subscribe({
      next: (result) => {
        this.data.set(result);
        this.topLimitStr.set('5');
        this.topChannelIdStr.set('');
        this.topSalespeopleOverride.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Independiente de `/today`: si falla, no rompe el resto del Inicio — doc 66, sección 3.2. */
  loadPending() {
    this.pendingLoading.set(true);
    this.pendingError.set(false);
    this.dashboardSvc.pending().subscribe({
      next: (result) => {
        this.pendingData.set(result);
        this.pendingLoading.set(false);
        this.pendingUpdatedAt.set(new Date());
      },
      error: () => {
        this.pendingLoading.set(false);
        this.pendingError.set(true);
      },
    });
  }

  private loadTopSalespeople(limit: number, salesChannelId?: number) {
    this.topLoading.set(true);
    this.dashboardSvc.topSalespeople(this.date(), limit, salesChannelId).subscribe({
      next: (result) => {
        this.topSalespeopleOverride.set(result);
        this.topLoading.set(false);
      },
      error: () => {
        this.topLoading.set(false);
      },
    });
  }

  protected amountPct(part: number, whole: number): number {
    if (!whole) return 0;
    return Math.min(100, Math.round((part / whole) * 100));
  }

  protected deliveryProgressPct(delivery: DashboardDeliverySummaryView): number {
    if (!delivery.totalItems) return 0;
    return Math.round(
      ((delivery.totalItems - delivery.itemStatusCounts.pending) / delivery.totalItems) * 100,
    );
  }

  protected batchStatusSegments(delivery: DashboardDeliverySummaryView) {
    const total = delivery.totalBatches || 1;
    let cumulativePct = 0;
    return BATCH_STATUS_OPTIONS.map((opt) => {
      const count = delivery.batchesByStatus.find((b) => b.statusCode === opt.code)?.count ?? 0;
      const pct = (count / total) * 100;
      const startDeg = (cumulativePct / 100) * 360;
      cumulativePct += pct;
      const endDeg = (cumulativePct / 100) * 360;
      return {
        code: opt.code,
        name: opt.name,
        count,
        pct: Math.round(pct),
        colorVar: `var(${BATCH_STATUS_COLOR_VAR[opt.code]})`,
        startDeg,
        endDeg,
      };
    });
  }

  protected donutGradient(delivery: DashboardDeliverySummaryView): string {
    if (!delivery.totalBatches) return 'var(--faint)';
    const stops = this.batchStatusSegments(delivery)
      .map((s) => `${s.colorVar} ${s.startDeg}deg ${s.endDeg}deg`)
      .join(', ');
    return `conic-gradient(${stops})`;
  }

  protected productBarPct(products: TopProductView[], qty: number): number {
    const max = Math.max(...products.map((p) => p.totalQuantity), 1);
    return Math.round((qty / max) * 100);
  }

  protected roleColor(index: number): string {
    return ROLE_AVATAR_COLORS[index % ROLE_AVATAR_COLORS.length];
  }

  // — Pedidos del día —
  protected statusTone(statusCode: string): string {
    return ORDER_STATUS_TONE_VAR[statusCode] ?? '--ink-muted';
  }

  protected statusBarPct(orders: DashboardOrdersSummaryView, s: { count: number }): number {
    const total = orders.byStatus.reduce((sum, o) => sum + o.count, 0) || 1;
    return Math.round((s.count / total) * 100);
  }

  protected orderStatusParams(statusCode: string) {
    return { ...this.dayParams(), statusCode };
  }

  protected orderOriginParams(originCode: string) {
    return { ...this.dayParams(), originCode };
  }

  protected visibleOrigins(orders: DashboardOrdersSummaryView) {
    return orders.byOrigin.filter((o) => o.count > 0);
  }

  protected originBarPct(orders: DashboardOrdersSummaryView, count: number): number {
    const max = Math.max(...orders.byOrigin.map((o) => o.count), 1);
    return Math.round((count / max) * 100);
  }

  /** "Facturados por el ERP: N de M enviados" — solo si hubo enviados (sección 3.3). */
  protected erpFacturadosLine(
    orders: DashboardOrdersSummaryView,
  ): { uploaded: number; sent: number; pct: number } | null {
    const sent = orders.byStatus.find((s) => s.statusCode === 'SENT_TO_BILLING')?.count ?? 0;
    if (sent === 0) return null;
    return {
      uploaded: orders.erpUploadedCount,
      sent,
      pct: Math.min(100, Math.round((orders.erpUploadedCount / sent) * 100)),
    };
  }
}
