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
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { AuthService } from '../../../core/auth/auth';
import { resolveCssVar, escapeHtml } from '../../assignments/map/map-markers';
import { BatchCustomerView, BatchSummary } from '../../../shared/models/delivery.models';
import { formatSoles } from '../../../shared/pipes/money';
import { itemStatusName } from '../delivery-format';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];

const ITEM_STATUS_COLOR_VAR: Record<string, string> = {
  PENDING: '--st-pending',
  DELIVERED: '--st-delivered',
  PARTIAL: '--st-partial',
  REJECTED: '--st-rejected',
};

function toValidCoord(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export interface DeliveryDayMapPoint {
  batchId: number;
  batchLabel: string; // "F001-1246"
  customer: BatchCustomerView;
}

/**
 * Mapa del día de reparto (requisito del usuario junto al doc 50): todas
 * las planillas de hoy en un solo mapa, filtrable por planilla. Mismo
 * componente/librería (Leaflet) y mismo criterio de color por estado del
 * comprobante que `app-batch-map` (doc 34) — no se reinventa el mapa, se
 * reutilizan sus utilidades de `assignments/map/map-markers`.
 */
@Component({
  selector: 'app-reparto-day-map',
  template: `
    <div class="rdm-toolbar">
      <label class="rdm-filter-label">
        Planilla
        <select class="rdm-filter" [value]="selectedBatchId()" (change)="onFilterChange($event)">
          <option value="">Todas</option>
          @for (b of batches(); track b.batchId) {
            <option [value]="b.batchId">{{ b.series }}-{{ b.number }}</option>
          }
        </select>
      </label>
      <div class="rdm-legend">
        @for (opt of legendEntries; track opt.code) {
          <span class="rdm-legend-item">
            <span class="rdm-legend-dot" [class]="'rdm-legend-' + opt.code.toLowerCase()"></span>
            {{ opt.name }}
          </span>
        }
      </div>
    </div>
    <div class="rdm-canvas" #mapEl></div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rdm-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 10px;
      }
      .rdm-filter-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
      }
      .rdm-filter {
        font-family: var(--font-sans);
        font-size: 13px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        min-height: 34px;
        padding: 0 10px;
      }
      .rdm-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .rdm-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .rdm-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .rdm-legend-pending {
        background: var(--st-pending);
      }
      .rdm-legend-delivered {
        background: var(--st-delivered);
      }
      .rdm-legend-partial {
        background: var(--st-partial);
      }
      .rdm-legend-rejected {
        background: var(--st-rejected);
      }
      .rdm-canvas {
        height: 440px;
        border: 1px solid var(--hairline);
      }

      @media (max-width: 767px) {
        .rdm-canvas {
          height: 320px;
        }
      }
    `,
  ],
})
export class RepartoDayMap implements AfterViewInit, OnChanges, OnDestroy {
  batches = input<BatchSummary[]>([]);
  points = input<DeliveryDayMapPoint[]>([]);

  private router = inject(Router);
  private auth = inject(AuthService);

  protected legendEntries = [
    { code: 'PENDING', name: 'Pendiente' },
    { code: 'DELIVERED', name: 'Entregado' },
    { code: 'PARTIAL', name: 'Entrega parcial' },
    { code: 'REJECTED', name: 'Rechazado' },
  ];

  protected canViewInvoice = computed(() => this.auth.hasAny('customer.view', 'invoice.reconcile'));
  protected selectedBatchId = signal<number | ''>('');

  protected visiblePoints = computed(() => {
    const id = this.selectedBatchId();
    const points = this.points();
    return id === '' ? points : points.filter((p) => p.batchId === id);
  });

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
    if (changes['points'] && this.viewReady) this.redraw();
  }

  protected onFilterChange(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value;
    this.selectedBatchId.set(value === '' ? '' : Number(value));
    this.redraw();
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

  private popupHtml(p: DeliveryDayMapPoint): string {
    const c = p.customer;
    const viewLink = this.canViewInvoice()
      ? `<button type="button" class="rdm-popup-view-btn" data-invoice-id="${escapeHtml(c.invoiceId)}">Ver factura</button>`
      : '';
    return `
      <strong>${escapeHtml(c.businessName)}</strong><br>
      Planilla ${escapeHtml(p.batchLabel)}<br>
      ${escapeHtml(c.address || 'Sin dirección')}<br>
      ${formatSoles(c.amount)}<br>
      ${escapeHtml(itemStatusName(c.itemStatusCode))}
      ${viewLink ? '<br>' + viewLink : ''}
    `;
  }

  private bindPopupViewButton(marker: L.Layer, invoiceId: string) {
    marker.on('popupopen', (ev) => {
      const el = (ev as L.PopupEvent).popup.getElement();
      el?.querySelector('.rdm-popup-view-btn')?.addEventListener('click', () => {
        this.router.navigate(['/factura', invoiceId]);
      });
    });
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    for (const p of this.visiblePoints()) {
      const c = p.customer;
      const lat = toValidCoord(c.latitude);
      const lng = toValidCoord(c.longitude);
      if (lat === null || lng === null) continue;
      const varName = ITEM_STATUS_COLOR_VAR[c.itemStatusCode] ?? '--ink-muted';
      const color = resolveCssVar(varName);
      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85,
      }).bindPopup(this.popupHtml(p));
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
