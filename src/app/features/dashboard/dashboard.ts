import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { NAV, NavItem } from '../../core/layout/nav.config';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiButton } from '../../shared/ui/button/button';
import { DashboardAdminService } from './dashboard-admin';
import {
  DashboardCustomersView,
  DashboardDeliverySummaryView,
  DashboardOrdersSummaryView,
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

/**
 * Home — resumen del día en 6 bloques (pedidos, reparto, usuarios activos
 * por rol, mejores ventas, producto en mejor movimiento, clientes
 * atendidos), todo desde un único endpoint agregado
 * (GET /api/admin/dashboard/today, `report.view`). Reemplaza la versión
 * anterior armada en frontend a partir de muestras de otros módulos.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, HasPermissionDirective, UiField, UiEmpty, UiButton],
  template: `
    <section class="home-page">
      <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
      <p class="home-sub">Resumen del día de un vistazo.</p>

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
          <!-- 1. Pedidos del día -->
          <div class="home-block">
            <h2 class="home-block-title">Pedidos del día</h2>
            <div class="home-kpi-row">
              <a class="home-kpi" routerLink="/pedidos">
                <span class="home-kpi-value">{{ d.orders.totalOrders }}</span>
                <span class="home-kpi-label">Pedidos hoy</span>
              </a>
              <div class="home-kpi">
                <span class="home-kpi-value">{{ formatSoles(d.orders.totalAmount) }}</span>
                <span class="home-kpi-label">Monto total</span>
              </div>
              <div class="home-kpi">
                <span class="home-kpi-value">{{ d.orders.totalBonusLines }}</span>
                <span class="home-kpi-label">Bonificaciones entregadas</span>
                <span class="home-kpi-compare">{{ d.orders.totalBonusUnits }} unidades</span>
              </div>
              <div class="home-kpi">
                <span class="home-kpi-value">{{ d.orders.topBrandName ?? 'Sin ventas' }}</span>
                <span class="home-kpi-label">Marca más vendida</span>
                @if (d.orders.topBrandAmount != null) {
                  <span class="home-kpi-compare"
                    >{{ formatSoles(d.orders.topBrandAmount) }} · {{ topBrandPct(d.orders) }}% del
                    monto del día</span
                  >
                }
              </div>
            </div>
          </div>

          <!-- 2. Reparto -->
          <div class="home-block">
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

          <!-- 3. Usuarios activos hoy -->
          <div class="home-block">
            <h2 class="home-block-title">Usuarios activos hoy</h2>
            @if (d.activeUsers.byRole.length === 0) {
              <p class="home-block-empty">Nadie ha iniciado ruta todavía.</p>
            } @else {
              <div class="home-roles-grid">
                @for (r of d.activeUsers.byRole; track r.roleCode; let i = $index) {
                  <div class="home-role-card">
                    <span class="home-role-avatar" [style.background]="roleColor(i)">{{
                      r.roleName.charAt(0)
                    }}</span>
                    <span class="home-role-count">{{ r.activeCount }}</span>
                    <span class="home-role-name">{{ r.roleName }}</span>
                  </div>
                }
              </div>
            }
          </div>

          <!-- 4-5-6 -->
          <div class="home-triple-grid">
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

            <div class="home-block">
              <h2 class="home-block-title">Clientes atendidos hoy</h2>
              <div class="home-ring-wrap">
                <div class="home-ring" [style.background]="customersRingGradient(d.customers)">
                  <div class="home-ring-hole">
                    <span class="home-ring-value"
                      >{{ d.customers.coveragePercentage.toFixed(0) }}%</span
                    >
                  </div>
                </div>
                <div class="home-ring-body">
                  <span class="home-ring-count">{{ d.customers.customersWithOrder }}</span>
                  <span class="home-ring-note"
                    >clientes con pedido hoy de {{ d.customers.totalActiveCustomers }} activos en
                    cartera</span
                  >
                </div>
              </div>
            </div>
          </div>

          <p class="home-dash-footer">Datos al {{ d.date }}.</p>
        }
      }

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
        <a
          class="home-tile is-ready"
          routerLink="/reportes-ventas"
          *hasPermission="'order.view_all'"
        >
          <span class="home-tile-name">Reportes de ventas</span>
          <span class="home-tile-note"
            >Resumen del día, liquidación de vendedores y ventas por marca.</span
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
        <a
          class="home-tile is-ready"
          routerLink="/empresa/sistema"
          *hasPermission="['config.edit', 'system.maintenance.manage']"
        >
          <span class="home-tile-name">Mantenimiento</span>
          <span class="home-tile-note">Activa o desactiva el modo mantenimiento del sistema.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/reparto"
          *hasPermission="['delivery.deliver', 'delivery.settle', 'delivery.manage']"
        >
          <span class="home-tile-name">Reparto</span>
          <span class="home-tile-note">Planillas, mapa de entregas y devoluciones.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/flota"
          *hasPermission="['delivery.settle', 'delivery.manage']"
        >
          <span class="home-tile-name">Flota</span>
          <span class="home-tile-note">Vehículos y equipos de reparto.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/facturas" *hasPermission="'invoice.reconcile'">
          <span class="home-tile-name">Facturas</span>
          <span class="home-tile-note">Conciliación con pedidos y bandeja sin conciliar.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/precios"
          *hasPermission="['price.view', 'product.edit']"
        >
          <span class="home-tile-name">Catálogo y precios</span>
          <span class="home-tile-note">Productos, escala de precios y seguimiento sin precio.</span>
        </a>
        <a
          class="home-tile is-ready"
          routerLink="/inventario"
          *hasPermission="['report.view', 'config.edit']"
        >
          <span class="home-tile-name">Inventario</span>
          <span class="home-tile-note">Stock por almacén, kardex y ajustes.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/usuarios" *hasPermission="'user.manage'">
          <span class="home-tile-name">Usuarios</span>
          <span class="home-tile-note">Alta, roles, contraseñas y estado de cada usuario.</span>
        </a>
        <a class="home-tile is-ready" routerLink="/empresa" *hasPermission="'config.edit'">
          <span class="home-tile-name">Empresa</span>
          <span class="home-tile-note">Sedes y parámetros de configuración.</span>
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

      .home-toolbar {
        margin-top: 20px;
        max-width: 620px;
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
      }
      .home-toolbar ui-field {
        max-width: 220px;
      }
      .home-reparto-link {
        white-space: nowrap;
      }
      .home-dash-skeleton {
        height: 320px;
        background: var(--faint);
        margin-top: 20px;
      }
      .home-dash-footer {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }

      .home-block {
        border: 1px solid var(--hairline);
        padding: 18px 20px;
        margin-top: 18px;
      }
      .home-block-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 16px;
        color: var(--ink);
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

      /* — Bloque 1: KPIs — */
      .home-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
        gap: 14px;
      }
      .home-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
        text-decoration: none;
        color: inherit;
        display: block;
        transition: border-color var(--dur-fast) var(--ease-standard);
      }
      a.home-kpi:hover {
        border-color: var(--accent);
      }
      .home-kpi-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
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

      /* — Bloque 2: Reparto — */
      .home-reparto-grid {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 32px;
      }
      .home-reparto-bars {
        display: grid;
        gap: 14px;
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
        height: 14px;
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
        margin-top: 6px;
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
        gap: 12px;
        align-content: start;
        justify-items: center;
      }
      .home-donut-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .home-donut {
        width: 140px;
        height: 140px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .home-donut-hole {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .home-donut-value {
        font-size: 22px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-donut-label {
        font-size: 11px;
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

      /* — Bloque 3: usuarios activos — */
      .home-roles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(140px, 100%), 1fr));
        gap: 14px;
      }
      .home-role-card {
        border: 1px solid var(--hairline);
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }
      .home-role-avatar {
        width: 34px;
        height: 34px;
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

      /* — Bloques 4-5-6 — */
      .home-triple-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
        margin-top: 18px;
      }
      .home-triple-grid .home-block {
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

      .home-ring-wrap {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .home-ring {
        width: 110px;
        height: 110px;
        border-radius: 50%;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .home-ring-hole {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--bg);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .home-ring-value {
        font-size: 18px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-ring-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .home-ring-count {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .home-ring-note {
        font-size: 12px;
        color: var(--ink-muted);
        max-width: 160px;
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

      @media (max-width: 1100px) {
        .home-triple-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 900px) {
        .home-reparto-grid {
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
  readonly promoPermissions = ['promo.create', 'promo.approve', 'promo.allocate'];

  protected formatSoles = formatSoles;
  protected showDashboard = computed(() => this.auth.hasAny('report.view'));
  /** Doc 50, sección 5.1: también tiene reparto (p. ej. el Administrador) — acceso directo a su inicio. */
  protected canGoToReparto = computed(() => this.auth.hasAny('delivery.manage'));

  protected date = signal(todayIso());
  protected data = signal<DashboardTodayView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

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

  protected topBrandPct(orders: DashboardOrdersSummaryView): number {
    if (!orders.topBrandAmount || !orders.totalAmount) return 0;
    return Math.round((orders.topBrandAmount / orders.totalAmount) * 100);
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

  protected customersRingGradient(c: DashboardCustomersView): string {
    const pct = Math.max(0, Math.min(100, c.coveragePercentage));
    const deg = pct * 3.6;
    return `conic-gradient(var(--accent) 0deg ${deg}deg, var(--faint) ${deg}deg 360deg)`;
  }

  protected roleColor(index: number): string {
    return ROLE_AVATAR_COLORS[index % ROLE_AVATAR_COLORS.length];
  }

  /** Los módulos apagados que este usuario sí puede ver en el menú. */
  pendingModules(): NavItem[] {
    return NAV.filter((i) => i.comingSoon && this.auth.hasAny(...i.anyOf));
  }
}
