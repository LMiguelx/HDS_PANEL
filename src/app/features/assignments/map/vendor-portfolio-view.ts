import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { UiField } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { AssignmentMapAdminService } from '../assignment-map-admin';
import { MapCustomerPopup } from './customer-popup';
import { portfolioPointIcon } from './map-markers';
import { mapVendorColorVar } from '../map-format';
import {
  MapCustomerPopupView,
  MapPortfolioCustomerView,
  MapPortfolioResponse,
} from '../../../shared/models/assignment-map.models';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];
const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

/** Cartera completa de un vendedor — doc 40, sección 8. Sin recorrido ni bitácora. */
@Component({
  selector: 'app-map-vendor-portfolio-view',
  imports: [UiField, UiEmpty, MapCustomerPopup],
  templateUrl: './vendor-portfolio-view.html',
  styleUrls: ['./vendor-portfolio-view.scss'],
})
export class MapVendorPortfolioView {
  private mapSvc = inject(AssignmentMapAdminService);
  private injector = inject(Injector);

  userId = input.required<number>();
  date = input('');

  protected weekdays = WEEKDAY_LABELS;
  protected mapVendorColorVar = mapVendorColorVar;

  protected data = signal<MapPortfolioResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected dayFilter = signal<number | null>(null); // null = Todos
  protected search = signal('');

  protected byWeekdayMap = computed(() => {
    const map = new Map<number, number>();
    for (const w of this.data()?.byWeekday ?? []) map.set(w.weekday, w.customers);
    return map;
  });

  protected filteredCustomers = computed(() => {
    const data = this.data();
    if (!data) return [];
    const day = this.dayFilter();
    const q = this.search().trim().toLowerCase();
    return data.customers.filter((c) => {
      if (day != null && !c.weekdays.includes(day)) return false;
      if (q && !c.customerName.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private markerByCustomer = new Map<number, L.Marker>();
  private firstDraw = true;

  protected popupCustomerId = signal<number | null>(null);
  protected popupData = signal<MapCustomerPopupView | null>(null);
  protected popupLoading = signal(false);
  protected popupError = signal(false);
  protected popupPosition = signal<{ x: number; y: number } | null>(null);

  constructor() {
    effect(() => {
      const userId = this.userId();
      const date = this.date();
      untracked(() => this.load(userId, date));
    });

    effect(() => {
      // redibuja cuando cambia el filtro de día o de búsqueda
      this.filteredCustomers();
      untracked(() => this.redraw());
    });
  }

  private load(userId: number, date: string) {
    this.loading.set(true);
    this.error.set(false);
    this.firstDraw = true;
    this.mapSvc.vendorPortfolio(userId, date).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
        if (!this.leafletMap) {
          afterNextRender(
            () => {
              this.ensureMap();
              this.redraw();
            },
            { injector: this.injector },
          );
        } else {
          this.redraw();
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private ensureMap() {
    if (this.leafletMap) return;
    const el = this.mapEl()?.nativeElement;
    if (!el) return;
    this.leafletMap = L.map(el, { preferCanvas: true }).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.leafletMap);
    this.markersLayer = L.layerGroup().addTo(this.leafletMap);
    this.leafletMap.on('click', () => this.closePopup());
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    this.markerByCustomer.clear();
    const data = this.data();
    if (!data) return;
    const colorVar = mapVendorColorVar(data.vendor.mapColor);
    const bounds: L.LatLngExpression[] = [];
    for (const c of this.filteredCustomers()) {
      if (c.latitude == null || c.longitude == null) continue;
      const visitedStatus = c.status !== 'PENDING' ? c.status : null;
      const icon = portfolioPointIcon(
        colorVar,
        c.scheduledOnDate,
        visitedStatus,
        c.coveredByUserId != null,
      );
      const marker = L.marker([c.latitude, c.longitude], { icon });
      marker.on('click', (ev) => this.openPopup(c, ev));
      this.markersLayer.addLayer(marker);
      this.markerByCustomer.set(c.customerId, marker);
      bounds.push([c.latitude, c.longitude]);
    }
    if (this.firstDraw && bounds.length > 0) {
      this.leafletMap.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [24, 24],
        maxZoom: 15,
      });
      this.firstDraw = false;
    }
  }

  protected selectDay(day: number | null) {
    this.dayFilter.set(day);
  }

  protected focusCustomer(c: MapPortfolioCustomerView) {
    if (!this.leafletMap || c.latitude == null || c.longitude == null) return;
    this.leafletMap.setView([c.latitude, c.longitude], Math.max(this.leafletMap.getZoom(), 15));
    this.markerByCustomer.get(c.customerId)?.openPopup();
  }

  protected openPopup(c: MapPortfolioCustomerView, ev: L.LeafletMouseEvent) {
    if (!this.leafletMap) return;
    const point = this.leafletMap.latLngToContainerPoint(ev.latlng);
    this.popupPosition.set({ x: point.x, y: point.y });
    this.popupCustomerId.set(c.customerId);
    this.popupData.set(null);
    this.popupLoading.set(true);
    this.popupError.set(false);
    this.mapSvc.customerPopup(c.customerId, this.date()).subscribe({
      next: (d) => {
        this.popupLoading.set(false);
        this.popupData.set(d);
      },
      error: () => {
        this.popupLoading.set(false);
        this.popupError.set(true);
      },
    });
  }

  protected closePopup() {
    this.popupCustomerId.set(null);
    this.popupPosition.set(null);
  }
}
