import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AuthService } from '../../../core/auth/auth';
import { BatchCustomerView } from '../../../shared/models/delivery.models';
import { formatSoles } from '../../../shared/pipes/money';
import { itemStatusName } from '../delivery-format';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];

const ITEM_STATUS_COLOR_VAR: Record<string, string> = {
  PENDING: '--st-pending',
  DELIVERED: '--st-delivered',
  PARTIAL: '--st-partial',
  REJECTED: '--st-rejected',
};

function resolveCssVar(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || '#888888';
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** El backend puede mandar el BigDecimal como string en el JSON — se
 * normaliza siempre a número antes de usarlo, y se descarta si no es un
 * punto válido (en vez de romper el render del mapa). */
function toValidCoord(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Mapa de entregas de una planilla (GET /batches/{id}/customers) — mismo
 * componente/librería (Leaflet) que el mapa de Asignaciones. Cada punto se
 * colorea según `itemStatusCode`; clic muestra nombre, dirección, monto y
 * estado, con un enlace a la ficha de la factura. Los clientes sin
 * latitud/longitud válidas se listan aparte en vez de romper el mapa.
 */
@Component({
  selector: 'app-batch-map',
  imports: [RouterLink],
  template: `
    <div class="bm-legend">
      @for (opt of legendEntries; track opt.code) {
        <span class="bm-legend-item">
          <span class="bm-legend-dot" [class]="'bm-legend-' + opt.code.toLowerCase()"></span>
          {{ opt.name }}
        </span>
      }
    </div>
    <div class="bm-canvas" #mapEl></div>

    @if (unlocated().length > 0) {
      <div class="bm-unlocated">
        <span class="bm-unlocated-title"
          >Sin ubicación ({{ unlocated().length }}) — no tienen coordenadas del ERP</span
        >
        <div class="bm-unlocated-list">
          @for (c of unlocated(); track c.customerId) {
            <div class="bm-unlocated-row">
              <span class="bm-unlocated-name">{{ c.businessName }}</span>
              @if (canViewInvoice()) {
                <a [routerLink]="['/factura', c.invoiceId]" class="bm-unlocated-link">{{
                  c.invoiceId
                }}</a>
              } @else {
                <span class="bm-unlocated-invoice">{{ c.invoiceId }}</span>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .bm-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 10px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bm-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .bm-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .bm-legend-pending {
        background: var(--st-pending);
      }
      .bm-legend-delivered {
        background: var(--st-delivered);
      }
      .bm-legend-partial {
        background: var(--st-partial);
      }
      .bm-legend-rejected {
        background: var(--st-rejected);
      }
      .bm-canvas {
        height: 440px;
        border: 1px solid var(--hairline);
      }
      .bm-unlocated {
        margin-top: 16px;
        border: 1px solid var(--hairline);
        padding: 12px 14px;
      }
      .bm-unlocated-title {
        display: block;
        font-size: 12px;
        font-weight: 800;
        color: var(--ink-muted);
        margin-bottom: 8px;
      }
      .bm-unlocated-list {
        display: grid;
        gap: 6px;
      }
      .bm-unlocated-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .bm-unlocated-name {
        color: var(--ink);
      }
      .bm-unlocated-link {
        color: var(--accent);
        font-weight: 800;
        text-decoration: none;
      }
      .bm-unlocated-link:hover {
        text-decoration: underline;
      }
      .bm-unlocated-invoice {
        color: var(--ink-muted);
        font-weight: 800;
      }

      @media (max-width: 767px) {
        .bm-canvas {
          height: 360px;
        }
      }
    `,
  ],
})
export class BatchMap implements AfterViewInit, OnChanges, OnDestroy {
  customers = input<BatchCustomerView[]>([]);

  private router = inject(Router);
  private auth = inject(AuthService);

  protected legendEntries = [
    { code: 'PENDING', name: 'Pendiente' },
    { code: 'DELIVERED', name: 'Entregado' },
    { code: 'PARTIAL', name: 'Entrega parcial' },
    { code: 'REJECTED', name: 'Rechazado' },
  ];

  protected canViewInvoice = computed(() => this.auth.hasAny('customer.view', 'invoice.reconcile'));

  protected located = computed(() =>
    this.customers().filter(
      (c) => toValidCoord(c.latitude) !== null && toValidCoord(c.longitude) !== null,
    ),
  );
  protected unlocated = computed(() =>
    this.customers().filter(
      (c) => toValidCoord(c.latitude) === null || toValidCoord(c.longitude) === null,
    ),
  );

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private viewReady = false;

  ngAfterViewInit() {
    this.viewReady = true;
    this.ensureMap();
    this.redraw();
  }

  ngOnDestroy() {
    this.leafletMap?.remove();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['customers'] && this.viewReady) this.redraw();
  }

  private ensureMap() {
    if (this.leafletMap) return;
    const el = this.mapEl()?.nativeElement;
    if (!el) return;
    this.leafletMap = L.map(el).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.leafletMap);
    this.markersLayer = L.layerGroup().addTo(this.leafletMap);
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private popupHtml(c: BatchCustomerView): string {
    const viewLink = this.canViewInvoice()
      ? `<button type="button" class="bm-popup-view-btn" data-invoice-id="${escapeHtml(c.invoiceId)}">Ver factura</button>`
      : '';
    return `
      <strong>${escapeHtml(c.businessName)}</strong><br>
      ${escapeHtml(c.address || 'Sin dirección')}<br>
      ${formatSoles(c.amount)}<br>
      ${escapeHtml(itemStatusName(c.itemStatusCode))}
      ${viewLink ? '<br>' + viewLink : ''}
    `;
  }

  private bindPopupViewButton(marker: L.Layer, invoiceId: string) {
    marker.on('popupopen', (ev) => {
      const el = (ev as L.PopupEvent).popup.getElement();
      el?.querySelector('.bm-popup-view-btn')?.addEventListener('click', () => {
        this.router.navigate(['/factura', invoiceId]);
      });
    });
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    for (const c of this.located()) {
      const lat = toValidCoord(c.latitude)!;
      const lng = toValidCoord(c.longitude)!;
      const varName = ITEM_STATUS_COLOR_VAR[c.itemStatusCode] ?? '--ink-muted';
      const color = resolveCssVar(varName);
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85,
      }).bindPopup(this.popupHtml(c));
      this.bindPopupViewButton(marker, c.invoiceId);
      marker.addTo(this.markersLayer!);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 0) {
      this.leafletMap.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [24, 24],
        maxZoom: 15,
      });
    }
  }
}
