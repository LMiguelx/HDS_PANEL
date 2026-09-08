import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  input,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
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

/**
 * Mapa de entregas de una planilla (GET /batches/{id}/customers) — mismo
 * componente/librería (Leaflet) que el mapa de Asignaciones. Cada punto se
 * colorea según `itemStatusCode`; clic muestra nombre, dirección, monto y
 * estado.
 */
@Component({
  selector: 'app-batch-map',
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

  protected legendEntries = [
    { code: 'PENDING', name: 'Pendiente' },
    { code: 'DELIVERED', name: 'Entregado' },
    { code: 'PARTIAL', name: 'Entrega parcial' },
    { code: 'REJECTED', name: 'Rechazado' },
  ];

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
    return `
      <strong>${escapeHtml(c.businessName)}</strong><br>
      ${escapeHtml(c.address || 'Sin dirección')}<br>
      ${formatSoles(c.amount)}<br>
      ${escapeHtml(itemStatusName(c.itemStatusCode))}
    `;
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    for (const c of this.customers()) {
      const varName = ITEM_STATUS_COLOR_VAR[c.itemStatusCode] ?? '--ink-muted';
      const color = resolveCssVar(varName);
      L.circleMarker([c.latitude, c.longitude], {
        radius: 8,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(this.popupHtml(c))
        .addTo(this.markersLayer!);
      bounds.push([c.latitude, c.longitude]);
    }

    if (bounds.length > 0) {
      this.leafletMap.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [24, 24],
        maxZoom: 15,
      });
    }
  }
}
