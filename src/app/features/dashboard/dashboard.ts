import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { NAV, NavItem } from '../../core/layout/nav.config';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiButton } from '../../shared/ui/button/button';
import { DeliveryAdminService } from '../delivery/delivery-admin';
import { InvoiceAdminService } from '../billing/invoice-admin';
import { InvoiceSummary } from '../../shared/models/invoice.models';
import { BatchSummary } from '../../shared/models/delivery.models';
import { OrderAdminService } from '../orders/order-admin';
import { OrderSummary, PendingBonusOrderView } from '../../shared/models/order.models';
import { DELIVERY_STATUS_COLOR_VAR, DELIVERY_STATUS_OPTIONS } from '../orders/order-format';
import { formatSoles } from '../../shared/pipes/money';

const BATCH_SAMPLE_SIZE = 100; // tope documentado del endpoint (máx. 100)
const ORDER_SAMPLE_SIZE = 100; // GET /orders no filtra por fecha en backend
const INVOICE_SAMPLE_SIZE = 100; // GET /invoices/unmatched — mismo tope que los demás listados

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  actionLabel: string;
  link: (string | number)[];
}

interface FunnelRow {
  code: string;
  name: string;
  count: number;
  pct: number;
  colorVar: string;
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(isoDateTime: string): boolean {
  return new Date(isoDateTime).toDateString() === new Date().toDateString();
}

/**
 * Home en 4 niveles — estado del día → ritmo/avance → contexto → acciones
 * pendientes. Todos los KPIs se calculan en frontend sobre las muestras ya
 * cargadas (pedidos/planillas: hasta 100, el máximo documentado; facturas
 * sin conciliar: ídem) — se lo señala en cada bloque. El color se reserva
 * para estado: el semáforo del nivel 1 colapsa a 3 estados genéricos
 * (--status-ok/warn/danger); los gráficos de nivel 2/3 reutilizan los mismos
 * tokens --st-* que ya usan Pedidos/Reparto, para que el color signifique lo
 * mismo en el home que dentro de cada módulo.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, HasPermissionDirective, UiButton],
  template: `
    <section class="home-page">
      <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
      <p class="home-sub">¿Cómo va el día, vamos a llegar, qué se rompe y qué decido ahora?</p>

      <div class="home-grid-12">
        <!-- Nivel 1 — Estado del día -->
        @if (showDayStatus()) {
          <div class="home-block home-span-12">
            <div class="home-day-status" [class]="'is-' + dayStatus().level">
              <span class="home-day-dot"></span>
              <span class="home-day-label">{{ dayStatus().label }}</span>
            </div>

            <div class="home-kpi-row">
              @if (showOrderKpis()) {
                <a class="home-kpi" routerLink="/pedidos">
                  <span class="home-kpi-value">{{ orderKpis().todayCount }}</span>
                  <span class="home-kpi-label">Pedidos hoy</span>
                  <span class="home-kpi-compare">vs. {{ avgOrdersPerDay() }}/día prom.</span>
                </a>
                <a class="home-kpi" routerLink="/pedidos">
                  <span class="home-kpi-value">{{ formatSoles(orderKpis().todayAmount) }}</span>
                  <span class="home-kpi-label">Monto hoy</span>
                  <span class="home-kpi-compare"
                    >vs. {{ formatSoles(avgAmountPerDay()) }}/día prom.</span
                  >
                </a>
                <a class="home-kpi" routerLink="/pedidos" [queryParams]="{ estado: 'OPEN' }">
                  <span class="home-kpi-value">{{ orderKpis().openCount }}</span>
                  <span class="home-kpi-label">Abiertos hoy</span>
                  <span class="home-kpi-compare">de {{ orderKpis().todayCount }} pedidos hoy</span>
                </a>
                <a
                  class="home-kpi"
                  routerLink="/pedidos"
                  [queryParams]="{ estado: 'SENT_TO_BILLING' }"
                >
                  <span class="home-kpi-value">{{ orderKpis().billedCount }}</span>
                  <span class="home-kpi-label">Enviados a facturación hoy</span>
                  <span class="home-kpi-compare">de {{ orderKpis().todayCount }} pedidos hoy</span>
                </a>
              }
              @if (showPendingBonuses()) {
                <a class="home-kpi" routerLink="/pedidos/bonificaciones-pendientes">
                  <span class="home-kpi-value">{{ pendingBonusOrders().length }}</span>
                  <span class="home-kpi-label">Bonificaciones pendientes</span>
                  <span class="home-kpi-compare">de {{ orderKpis().openCount }} abiertos hoy</span>
                </a>
              }
              @if (showInvoiceKpis()) {
                <a class="home-kpi" routerLink="/facturas">
                  <span class="home-kpi-value">{{ unmatchedTotal() }}</span>
                  <span class="home-kpi-label">Facturas sin conciliar</span>
                  <span class="home-kpi-compare">{{ unmatchedTodayCount() }} nuevas hoy</span>
                </a>
              }
            </div>
          </div>
        }

        <!-- Nivel 2 — Ritmo / avance -->
        @if (showDeliveryKpis() || showOrderKpis()) {
          <div class="home-block home-span-6">
            <h2 class="home-card-title">Ritmo del día</h2>
            <p class="home-card-note">
              ¿Vamos a llegar? Avance de hoy sobre lo cargado hasta ahora.
            </p>

            @if (showOrderKpis()) {
              <div class="home-progress">
                <div class="home-progress-head">
                  <span>Pedidos → facturación</span>
                  <span class="home-progress-pct">{{ orderProgressPct() }}%</span>
                </div>
                <div class="home-progress-track">
                  <div class="home-progress-fill is-ok" [style.width.%]="orderProgressPct()"></div>
                </div>
                <span class="home-progress-note"
                  >{{ orderKpis().billedCount }} de {{ orderKpis().todayCount }} pedidos de hoy ya
                  avanzaron de estado.</span
                >
              </div>
            }
            @if (showDeliveryKpis()) {
              <div class="home-progress">
                <div class="home-progress-head">
                  <span>Planillas → liquidadas</span>
                  <span class="home-progress-pct">{{ batchProgressPct() }}%</span>
                </div>
                <div class="home-progress-track">
                  <div class="home-progress-fill is-ok" [style.width.%]="batchProgressPct()"></div>
                </div>
                @if (todayBatches().length === 0) {
                  <span class="home-progress-note">Todavía no hay planillas con fecha de hoy.</span>
                } @else {
                  <span class="home-progress-note">
                    @for (row of batchFunnel(); track row.code) {
                      <a
                        class="home-funnel-chip"
                        routerLink="/reparto"
                        [queryParams]="{ estado: row.code }"
                      >
                        <span class="home-kpi-dot" [style.background]="row.colorVar"></span>
                        {{ row.name }} {{ row.count }}
                      </a>
                    }
                  </span>
                }
              </div>
            }
          </div>
        }

        <!-- Nivel 3 — Contexto -->
        @if (showOrderKpis()) {
          <div class="home-block home-span-6">
            <h2 class="home-card-title">Qué se rompe — reparto por pedido</h2>
            <p class="home-card-note">
              Sobre la muestra cargada ({{ orders().length }} de {{ totalOrders() }} pedidos).
            </p>
            @if (ordersLoading()) {
              <div class="home-chart-skeleton" role="status" aria-label="Cargando"></div>
            } @else if (deliveryStatusBars().length === 0) {
              <p class="home-chart-empty">
                Ningún pedido de la muestra tiene reparto asociado todavía.
              </p>
            } @else {
              <div class="home-bar-chart">
                @for (row of deliveryStatusBars(); track row.code) {
                  <a
                    class="home-bar-row"
                    routerLink="/pedidos"
                    [queryParams]="{ reparto: row.code }"
                  >
                    <span class="home-bar-label">{{ row.name }}</span>
                    <div class="home-bar-track">
                      <div
                        class="home-bar-fill"
                        [style.width.%]="row.pct"
                        [style.background]="row.colorVar"
                      ></div>
                    </div>
                    <span class="home-bar-count">{{ row.count }}</span>
                  </a>
                }
              </div>
            }
          </div>
        }

        <!-- Nivel 4 — Acciones pendientes -->
        @if (actionItems().length > 0) {
          <div class="home-block home-span-12">
            <h2 class="home-card-title">Qué decido ahora</h2>
            <p class="home-card-note">
              Hasta 5 pendientes concretos, cada uno con su acción directa.
            </p>
            <div class="home-actions-list">
              @for (item of actionItems(); track item.id) {
                <div class="home-action-row">
                  <div>
                    <span class="home-action-title">{{ item.title }}</span>
                    <span class="home-action-subtitle">{{ item.subtitle }}</span>
                  </div>
                  <div class="home-action-tail">
                    @if (item.amount != null) {
                      <span class="home-action-amount">{{ formatSoles(item.amount) }}</span>
                    }
                    <button uiButton variant="secondary" size="sm" [routerLink]="item.link">
                      {{ item.actionLabel }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="home-section-label">Disponible</div>
      <div class="home-grid">
        <a
          class="home-tile is-ready"
          routerLink="/pedidos"
          *hasPermission="['order.view_all', 'order.create']"
        >
          <span class="home-tile-name">Pedidos</span>
          <span class="home-tile-note"
            >Búsqueda global, historial por cliente y bonificaciones pendientes.</span
          >
        </a>
        <a class="home-tile is-ready" routerLink="/promociones" *hasPermission="promoPermissions">
          <span class="home-tile-name">Promociones</span>
          <span class="home-tile-note"
            >Campañas, premios pendientes y dotaciones a vendedores.</span
          >
        </a>
        <a class="home-tile is-ready" routerLink="/asignaciones" *hasPermission="'customer.assign'">
          <span class="home-tile-name">Asignaciones</span>
          <span class="home-tile-note">Cartera por vendedor, ausencias del día y cobertura.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/clientes" *hasPermission="'customer.view'">
          <span class="home-tile-name">Clientes</span>
          <span class="home-tile-note">Buscador y ficha con métricas de compra.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/aprobaciones"
          *hasPermission="'customer.approve'"
        >
          <span class="home-tile-name">Aprobaciones</span>
          <span class="home-tile-note">Solicitudes de creación, cambio de campo y cierre.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/mantenimiento" *hasPermission="'config.edit'">
          <span class="home-tile-name">Mantenimiento</span>
          <span class="home-tile-note">Activa o desactiva el modo mantenimiento del sistema.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/reparto"
          *hasPermission="['delivery.deliver', 'delivery.settle']"
        >
          <span class="home-tile-name">Reparto</span>
          <span class="home-tile-note">Planillas, mapa de entregas y devoluciones.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/flota" *hasPermission="'delivery.settle'">
          <span class="home-tile-name">Flota</span>
          <span class="home-tile-note">Vehículos y equipos de reparto.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/facturas" *hasPermission="'invoice.reconcile'">
          <span class="home-tile-name">Facturas</span>
          <span class="home-tile-note">Conciliación con pedidos y bandeja sin conciliar.</span>
        </a>
      </div>

      <div class="home-section-label">Próximamente</div>
      <div class="home-grid">
        @for (item of pendingModules(); track item.route) {
          <a class="home-tile" [routerLink]="item.route">
            <span class="home-tile-name">{{ item.label }}</span>
            <span class="home-tile-note">Se rediseñará próximamente.</span>
          </a>
        }
      </div>
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
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
      }
      .home-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 620px;
      }

      /* — Rejilla de 12 columnas — */
      .home-grid-12 {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 16px;
        margin-top: 24px;
      }
      .home-span-12 {
        grid-column: span 12;
      }
      .home-span-6 {
        grid-column: span 6;
      }
      .home-block {
        border: 1px solid var(--hairline);
        padding: 18px 20px;
      }
      .home-card-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .home-card-note {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-chart-skeleton {
        height: 100px;
        background: var(--faint);
        margin-top: 14px;
      }
      .home-chart-empty {
        margin: 14px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }

      /* — Nivel 1: semáforo — */
      .home-day-status {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .home-day-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        flex: none;
      }
      .home-day-status.is-ok .home-day-dot {
        background: var(--status-ok);
      }
      .home-day-status.is-warn .home-day-dot {
        background: var(--status-warn);
      }
      .home-day-status.is-danger .home-day-dot {
        background: var(--status-danger);
      }
      .home-day-label {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }

      /* — Nivel 1: tiras de KPI — */
      .home-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(170px, 100%), 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .home-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
        text-decoration: none;
        color: inherit;
        display: block;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      .home-kpi:hover {
        border-color: var(--accent);
      }
      .home-kpi-value {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-kpi-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex: none;
      }
      .home-kpi-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-kpi-compare {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
      }

      /* — Nivel 2: barras de progreso — */
      .home-progress {
        margin-top: 18px;
      }
      .home-progress:first-of-type {
        margin-top: 16px;
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
        height: 14px;
        background: var(--faint);
      }
      .home-progress-fill {
        height: 100%;
        transition: width var(--dur-base) var(--ease-standard);
      }
      .home-progress-fill.is-ok {
        background: var(--status-ok);
      }
      .home-progress-note {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-funnel-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        color: var(--ink-muted);
        border: 1px solid var(--hairline);
        padding: 2px 8px;
      }
      .home-funnel-chip:hover {
        border-color: var(--accent);
        color: var(--ink);
      }

      /* — Nivel 3: gráfico de barras — */
      .home-bar-chart {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }
      .home-bar-row {
        display: grid;
        grid-template-columns: 90px 1fr 36px;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: inherit;
      }
      .home-bar-label {
        font-size: 13px;
        color: var(--ink-muted);
      }
      .home-bar-track {
        height: 14px;
        background: var(--faint);
      }
      .home-bar-fill {
        height: 100%;
        transition: width var(--dur-base) var(--ease-standard);
      }
      .home-bar-count {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }

      /* — Nivel 4: lista de acciones — */
      .home-actions-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        margin-top: 16px;
      }
      .home-action-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        background: var(--bg);
        padding: 12px 16px;
        flex-wrap: wrap;
      }
      .home-action-title {
        display: block;
        font-weight: 800;
        font-size: 14px;
        color: var(--ink);
      }
      .home-action-subtitle {
        display: block;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .home-action-tail {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .home-action-amount {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }

      /* — Navegación por tiles (ya existente) — */
      .home-section-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
        margin: 28px 0 14px;
      }
      .home-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
        gap: 12px;
      }
      .home-tile {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border: 1px solid var(--hairline);
        padding: 16px 18px;
        min-height: var(--touch-min);
        text-decoration: none;
        color: var(--ink-muted);
        opacity: 0.6;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      .home-tile:hover {
        border-color: var(--ink-muted);
      }
      .home-tile:focus-visible {
        outline: var(--border-focus);
        outline-offset: 2px;
      }
      .home-tile.is-ready {
        border: 2px solid var(--divider);
        color: var(--ink);
        opacity: 1;
      }
      .home-tile.is-ready:hover {
        border-color: var(--accent);
      }
      .home-tile-name {
        font-weight: 800;
        font-size: 16px;
      }
      .home-tile-note {
        font-size: 13px;
        line-height: 1.45;
      }

      @media (max-width: 900px) {
        .home-span-6 {
          grid-column: span 12;
        }
      }
      @media (max-width: 767px) {
        .home-page {
          padding: var(--sp-4);
        }
        .home-grid-12 {
          grid-template-columns: 1fr;
        }
        .home-span-12,
        .home-span-6 {
          grid-column: 1;
        }
        .home-action-row {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class DashboardPage {
  private auth = inject(AuthService);
  private deliverySvc = inject(DeliveryAdminService);
  private invoiceSvc = inject(InvoiceAdminService);
  private orderSvc = inject(OrderAdminService);

  readonly user = this.auth.currentUser;
  readonly promoPermissions = ['promo.create', 'promo.approve', 'promo.allocate'];

  protected formatSoles = formatSoles;

  protected showDeliveryKpis = computed(() =>
    this.auth.hasAny('delivery.deliver', 'delivery.settle'),
  );
  protected showInvoiceKpis = computed(() => this.auth.hasAny('invoice.reconcile'));
  protected showOrderKpis = computed(() => this.auth.hasAny('order.view_all', 'order.create'));
  protected showPendingBonuses = computed(() => this.auth.hasAny('order.view_all'));
  protected showDayStatus = computed(
    () => this.showOrderKpis() || this.showPendingBonuses() || this.showInvoiceKpis(),
  );

  protected batches = signal<BatchSummary[]>([]);
  protected totalBatches = signal(0);
  protected batchesLoading = signal(false);

  protected unmatchedInvoices = signal<InvoiceSummary[]>([]);
  protected unmatchedTotal = signal(0);
  protected invoicesLoading = signal(false);

  protected orders = signal<OrderSummary[]>([]);
  protected totalOrders = signal(0);
  protected ordersLoading = signal(false);

  protected pendingBonusOrders = signal<PendingBonusOrderView[]>([]);

  protected todayOrders = computed(() => this.orders().filter((o) => isToday(o.orderDate)));

  protected avgOrdersPerDay = computed(() => {
    const rows = this.orders().filter((o) => !isToday(o.orderDate));
    if (rows.length === 0) return 0;
    const days = new Set(rows.map((o) => new Date(o.orderDate).toDateString()));
    return Math.round(rows.length / days.size);
  });

  protected avgAmountPerDay = computed(() => {
    const rows = this.orders().filter((o) => !isToday(o.orderDate));
    if (rows.length === 0) return 0;
    const days = new Set(rows.map((o) => new Date(o.orderDate).toDateString()));
    const total = rows.reduce((sum, o) => sum + o.netAmount, 0);
    return total / days.size;
  });

  protected orderKpis = computed(() => {
    const rows = this.todayOrders();
    return {
      todayCount: rows.length,
      todayAmount: rows.reduce((sum, o) => sum + o.netAmount, 0),
      openCount: rows.filter((o) => o.statusCode === 'OPEN').length,
      billedCount: rows.filter((o) => o.statusCode === 'SENT_TO_BILLING').length,
    };
  });

  protected orderProgressPct = computed(() => {
    const rows = this.todayOrders();
    if (rows.length === 0) return 0;
    return Math.round((rows.filter((o) => o.statusCode !== 'OPEN').length / rows.length) * 100);
  });

  protected deliveryStatusBars = computed(() => {
    const rows = this.orders().filter((o) => !!o.deliveryStatusCode);
    const total = rows.length || 1;
    return DELIVERY_STATUS_OPTIONS.filter((opt) =>
      rows.some((o) => o.deliveryStatusCode === opt.code),
    ).map((opt) => {
      const count = rows.filter((o) => o.deliveryStatusCode === opt.code).length;
      return {
        code: opt.code,
        name: opt.name,
        count,
        pct: Math.round((count / total) * 100),
        colorVar: `var(${DELIVERY_STATUS_COLOR_VAR[opt.code]})`,
      };
    });
  });

  protected todayBatches = computed(() => {
    const today = todayIsoDate();
    return this.batches().filter((b) => b.batchDate === today);
  });

  protected batchFunnel = computed<FunnelRow[]>(() => {
    const rows = this.todayBatches();
    const total = rows.length || 1;
    const of = (code: string, name: string, colorVar: string) => {
      const count = rows.filter((b) => b.statusCode === code).length;
      return { code, name, count, pct: Math.round((count / total) * 100), colorVar };
    };
    return [
      of('OPEN', 'Abiertas', 'var(--st-open)'),
      of('IN_ROUTE', 'En ruta', 'var(--st-in-route)'),
      of('SETTLED', 'Liquidadas', 'var(--st-settled)'),
    ];
  });

  protected batchProgressPct = computed(() => {
    const rows = this.todayBatches();
    if (rows.length === 0) return 0;
    return Math.round((rows.filter((b) => b.statusCode !== 'OPEN').length / rows.length) * 100);
  });

  protected unmatchedTodayCount = computed(
    () => this.unmatchedInvoices().filter((i) => isToday(i.issueDate)).length,
  );

  protected dayStatus = computed(() => {
    const rejectedCount = this.orders().filter((o) => o.deliveryStatusCode === 'REJECTED').length;
    const mismatchCount = this.unmatchedInvoices().filter(
      (i) => i.matchStatusCode === 'MISMATCH',
    ).length;
    const openNoTeamToday = this.todayBatches().filter(
      (b) => b.statusCode === 'OPEN' && b.deliveryTeamId == null,
    ).length;

    if (rejectedCount > 0 || mismatchCount > 0) {
      return { level: 'danger', label: 'Atención — hay pendientes críticos hoy' };
    }
    if (this.pendingBonusOrders().length > 0 || this.unmatchedTotal() > 0 || openNoTeamToday > 0) {
      return { level: 'warn', label: 'Bajo control — con pendientes' };
    }
    return { level: 'ok', label: 'Día tranquilo' };
  });

  protected actionItems = computed<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    for (const o of this.orders()
      .filter((o) => o.deliveryStatusCode === 'REJECTED')
      .slice(0, 2)) {
      items.push({
        id: `rejected-${o.orderId}`,
        title: o.customerName,
        subtitle: `Pedido #${o.orderId} — rechazado en reparto`,
        actionLabel: 'Ver pedido',
        link: ['/pedidos/detalle', o.orderId],
      });
    }

    for (const inv of this.unmatchedInvoices()
      .filter((i) => i.matchStatusCode === 'MISMATCH')
      .slice(0, 2)) {
      items.push({
        id: `mismatch-${inv.invoiceId}`,
        title: inv.customerName,
        subtitle: `Factura ${inv.series}-${inv.number} — con diferencia`,
        amount: inv.grandTotal,
        actionLabel: 'Revisar',
        link: ['/factura', inv.invoiceId],
      });
    }

    const today = todayIsoDate();
    for (const b of this.batches()
      .filter((b) => b.batchDate === today && b.statusCode === 'OPEN' && b.deliveryTeamId == null)
      .slice(0, 2)) {
      items.push({
        id: `no-team-${b.batchId}`,
        title: `Planilla ${b.series}-${b.number}`,
        subtitle: 'Abierta hoy — sin equipo asignado',
        actionLabel: 'Asignar equipo',
        link: ['/reparto', b.batchId],
      });
    }

    if (items.length < 5) {
      for (const inv of this.unmatchedInvoices()
        .filter((i) => i.matchStatusCode !== 'MISMATCH')
        .slice(0, 5 - items.length)) {
        items.push({
          id: `unmatched-${inv.invoiceId}`,
          title: inv.customerName,
          subtitle: `Factura ${inv.series}-${inv.number} — sin conciliar`,
          amount: inv.grandTotal,
          actionLabel: 'Conciliar',
          link: ['/factura', inv.invoiceId],
        });
      }
    }

    if (items.length < 5) {
      for (const o of this.pendingBonusOrders().slice(0, 5 - items.length)) {
        items.push({
          id: `bonus-${o.orderId}`,
          title: o.customerName,
          subtitle: `Pedido #${o.orderId} — bonificación pendiente`,
          actionLabel: 'Ver pedido',
          link: ['/pedidos/detalle', o.orderId],
        });
      }
    }

    return items.slice(0, 5);
  });

  /** Los módulos apagados que este usuario sí puede ver en el menú. */
  pendingModules(): NavItem[] {
    return NAV.filter((i) => i.comingSoon && this.auth.hasAny(...i.anyOf));
  }

  constructor() {
    if (this.showDeliveryKpis()) this.loadBatches();
    if (this.showInvoiceKpis()) this.loadUnmatched();
    if (this.showOrderKpis()) this.loadOrders();
    if (this.showPendingBonuses()) this.loadPendingBonuses();
  }

  private loadBatches() {
    this.batchesLoading.set(true);
    this.deliverySvc.batchesAll({ page: 0, size: BATCH_SAMPLE_SIZE }).subscribe({
      next: (result) => {
        this.batches.set(result.content ?? []);
        this.totalBatches.set(result.totalElements ?? (result.content ?? []).length);
        this.batchesLoading.set(false);
      },
      error: () => this.batchesLoading.set(false),
    });
  }

  private loadUnmatched() {
    this.invoicesLoading.set(true);
    this.invoiceSvc.unmatched({ page: 0, size: INVOICE_SAMPLE_SIZE }).subscribe({
      next: (result) => {
        this.unmatchedInvoices.set(result.content ?? []);
        this.unmatchedTotal.set(result.totalElements ?? 0);
        this.invoicesLoading.set(false);
      },
      error: () => this.invoicesLoading.set(false),
    });
  }

  private loadOrders() {
    this.ordersLoading.set(true);
    this.orderSvc.list({ page: 0, size: ORDER_SAMPLE_SIZE }).subscribe({
      next: (result) => {
        this.orders.set(result.content ?? []);
        this.totalOrders.set(result.totalElements ?? (result.content ?? []).length);
        this.ordersLoading.set(false);
      },
      error: () => this.ordersLoading.set(false),
    });
  }

  private loadPendingBonuses() {
    this.orderSvc.pendingBonuses().subscribe({
      next: (list) => this.pendingBonusOrders.set(list),
      error: () => {},
    });
  }
}
