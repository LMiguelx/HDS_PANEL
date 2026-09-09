import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { NAV, NavItem } from '../../core/layout/nav.config';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { DeliveryAdminService } from '../delivery/delivery-admin';
import { BATCH_STATUS_COLOR_VAR, BATCH_STATUS_OPTIONS } from '../delivery/delivery-format';
import { InvoiceAdminService } from '../billing/invoice-admin';
import { InvoiceSummary } from '../../shared/models/invoice.models';
import { BatchSummary } from '../../shared/models/delivery.models';
import { formatSoles } from '../../shared/pipes/money';

const BATCH_SAMPLE_SIZE = 100; // tope documentado del endpoint (máx. 100)

/**
 * KPIs y estado sin agregación en backend: se calculan en frontend sobre la
 * muestra ya traída de GET /batches/all (hasta 100, el máximo permitido).
 * `totalBatches` sí es exacto (viene de totalElements); la distribución por
 * estado y los montos son sobre la muestra — se lo señala en la UI.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, HasPermissionDirective],
  template: `
    <section class="home-page">
      <h1>Bienvenido{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
      <p class="home-sub">Panel de control. Resumen de reparto y facturación de un vistazo.</p>

      @if (showDeliveryKpis()) {
        <div class="home-kpi-grid">
          <div class="home-kpi">
            <span class="home-kpi-value">{{ totalBatches() }}</span>
            <span class="home-kpi-label">Planillas totales</span>
          </div>
          @for (row of statusBars(); track row.code) {
            <div class="home-kpi">
              <span class="home-kpi-value">
                <span class="home-kpi-dot" [style.background]="row.colorVar"></span>{{ row.count }}
              </span>
              <span class="home-kpi-label">{{ row.name }}</span>
            </div>
          }
          <div class="home-kpi">
            <span class="home-kpi-value">{{ formatSoles(kpis().totalAmount) }}</span>
            <span class="home-kpi-label">Monto en reparto</span>
          </div>
          <div class="home-kpi">
            <span class="home-kpi-value">{{ formatSoles(kpis().netAmount) }}</span>
            <span class="home-kpi-label">Monto neto (post-devoluciones)</span>
          </div>
        </div>

        <div class="home-chart-card">
          <h2 class="home-card-title">Planillas por estado</h2>
          <p class="home-card-note">
            Calculado sobre la muestra cargada ({{ batches().length }} de {{ totalBatches() }}
            planillas).
          </p>
          @if (batchesLoading()) {
            <div class="home-chart-skeleton" role="status" aria-label="Cargando"></div>
          } @else if (batches().length === 0) {
            <p class="home-chart-empty">Todavía no hay planillas registradas.</p>
          } @else {
            <div class="home-bar-chart">
              @for (row of statusBars(); track row.code) {
                <div class="home-bar-row">
                  <span class="home-bar-label">{{ row.name }}</span>
                  <div class="home-bar-track">
                    <div
                      class="home-bar-fill"
                      [style.width.%]="row.pct"
                      [style.background]="row.colorVar"
                    ></div>
                  </div>
                  <span class="home-bar-count">{{ row.count }}</span>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (showInvoiceKpis()) {
        <div class="home-unmatched-card">
          <div class="home-unmatched-head">
            <div>
              <h2 class="home-card-title">Facturas sin conciliar</h2>
              <p class="home-card-note">Bandeja de trabajo de conciliación.</p>
            </div>
            <a routerLink="/facturas" class="home-unmatched-link">Ver todas →</a>
          </div>

          @if (invoicesLoading()) {
            <div class="home-chart-skeleton" role="status" aria-label="Cargando"></div>
          } @else {
            <div class="home-unmatched-count">{{ unmatchedTotal() }}</div>
            @if (unmatchedInvoices().length === 0) {
              <p class="home-chart-empty">Todas las facturas están conciliadas.</p>
            } @else {
              <div class="home-unmatched-list">
                @for (inv of unmatchedInvoices(); track inv.invoiceId) {
                  <div class="home-unmatched-row">
                    <span class="home-unmatched-customer">{{ inv.customerName }}</span>
                    <span class="home-unmatched-amount">{{ formatSoles(inv.grandTotal) }}</span>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <div class="home-section-label">Disponible</div>
      <div class="home-grid">
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

      /* — KPIs — */
      .home-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
        gap: 14px;
        margin-top: 24px;
      }
      .home-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
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

      /* — Tarjetas (gráfico / sin conciliar) — */
      .home-chart-card,
      .home-unmatched-card {
        border: 1px solid var(--hairline);
        padding: 18px 20px;
        margin-top: 18px;
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

      /* — Gráfico de barras (sin librería externa) — */
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

      /* — Sin conciliar — */
      .home-unmatched-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .home-unmatched-link {
        font-size: 13px;
        font-weight: 800;
        color: var(--accent);
        text-decoration: none;
        white-space: nowrap;
      }
      .home-unmatched-link:hover {
        text-decoration: underline;
      }
      .home-unmatched-count {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--accent-ink);
        margin-top: 12px;
        font-variant-numeric: var(--tnum);
      }
      .home-unmatched-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        margin-top: 12px;
      }
      .home-unmatched-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        background: var(--bg);
        padding: 8px 10px;
        font-size: 13px;
      }
      .home-unmatched-customer {
        color: var(--ink);
      }
      .home-unmatched-amount {
        color: var(--ink-muted);
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

      @media (max-width: 767px) {
        .home-page {
          padding: var(--sp-4);
        }
        .home-bar-row {
          grid-template-columns: 76px 1fr 30px;
        }
      }
    `,
  ],
})
export class DashboardPage {
  private auth = inject(AuthService);
  private deliverySvc = inject(DeliveryAdminService);
  private invoiceSvc = inject(InvoiceAdminService);

  readonly user = this.auth.currentUser;
  readonly promoPermissions = ['promo.create', 'promo.approve', 'promo.allocate'];

  protected formatSoles = formatSoles;

  protected showDeliveryKpis = computed(() =>
    this.auth.hasAny('delivery.deliver', 'delivery.settle'),
  );
  protected showInvoiceKpis = computed(() => this.auth.hasAny('invoice.reconcile'));

  protected batches = signal<BatchSummary[]>([]);
  protected totalBatches = signal(0);
  protected batchesLoading = signal(false);

  protected unmatchedInvoices = signal<InvoiceSummary[]>([]);
  protected unmatchedTotal = signal(0);
  protected invoicesLoading = signal(false);

  protected kpis = computed(() => {
    const rows = this.batches();
    return {
      totalAmount: rows.reduce((sum, b) => sum + b.totalAmount, 0),
      netAmount: rows.reduce((sum, b) => sum + b.netAmount, 0),
    };
  });

  protected statusBars = computed(() => {
    const rows = this.batches();
    const total = rows.length || 1;
    return BATCH_STATUS_OPTIONS.map((opt) => {
      const count = rows.filter((b) => b.statusCode === opt.code).length;
      return {
        code: opt.code,
        name: opt.name,
        count,
        pct: Math.round((count / total) * 100),
        colorVar: `var(${BATCH_STATUS_COLOR_VAR[opt.code]})`,
      };
    });
  });

  /** Los módulos apagados que este usuario sí puede ver en el menú. */
  pendingModules(): NavItem[] {
    return NAV.filter((i) => i.comingSoon && this.auth.hasAny(...i.anyOf));
  }

  constructor() {
    if (this.showDeliveryKpis()) this.loadBatches();
    if (this.showInvoiceKpis()) this.loadUnmatched();
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
    this.invoiceSvc.unmatched({ page: 0, size: 5 }).subscribe({
      next: (result) => {
        this.unmatchedInvoices.set(result.content ?? []);
        this.unmatchedTotal.set(result.totalElements ?? 0);
        this.invoicesLoading.set(false);
      },
      error: () => this.invoicesLoading.set(false),
    });
  }
}
