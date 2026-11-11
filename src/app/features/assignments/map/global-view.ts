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
import * as L from 'leaflet';
import { Router } from '@angular/router';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { AssignmentMapAdminService } from '../assignment-map-admin';
import { MapCustomerPopup } from './customer-popup';
import { resolveCssVar } from './map-markers';
import { mapVendorColorVar } from '../map-format';
import { formatSoles } from '../../../shared/pipes/money';
import {
  MapCustomerPopupView,
  MapGlobalPointView,
  MapGlobalResponse,
  MapOverviewResponse,
} from '../../../shared/models/assignment-map.models';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];
type LayerKey = 'ordered' | 'noOrder' | 'closed' | 'pending' | 'idle';

/** Día global — doc 40, sección 9. ~10 mil puntos, un solo lienzo, sin refresco automático. */
@Component({
  selector: 'app-map-global-view',
  imports: [UiEmpty, MapCustomerPopup],
  templateUrl: './global-view.html',
  styleUrls: ['./global-view.scss'],
})
export class MapGlobalView {
  private mapSvc = inject(AssignmentMapAdminService);
  private router = inject(Router);
  private injector = inject(Injector);

  date = input('');
  overview = input<MapOverviewResponse | null>(null);

  protected mapVendorColorVar = mapVendorColorVar;
  protected formatSoles = formatSoles;

  protected data = signal<MapGlobalResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected drawing = signal(false);
  protected drawProgress = signal(0);

  protected onlyActiveToday = signal(false);
  protected layerVisible = signal<Record<LayerKey, boolean>>({
    ordered: true,
    noOrder: true,
    closed: true,
    pending: true,
    idle: true,
  });

  protected layerCounts = computed(() => {
    const counts: Record<LayerKey, number> = {
      ordered: 0,
      noOrder: 0,
      closed: 0,
      pending: 0,
      idle: 0,
    };
    for (const p of this.data()?.points ?? []) counts[this.layerKeyFor(p)]++;
    return counts;
  });

  protected ticketAvg = computed(() => {
    const t = this.data()?.totals;
    if (!t || t.orderCount === 0) return 0;
    return t.orderAmount / t.orderCount;
  });

  protected ranking = computed(() =>
    [...(this.overview()?.vendors ?? [])].sort(
      (a, b) => b.counters.orderAmount - a.counters.orderAmount,
    ),
  );
  protected vendorsInRoute = computed(() => {
    const vendors = this.overview()?.vendors ?? [];
    const withPlan = vendors.filter((v) => v.counters.planned > 0);
    return {
      inRoute: vendors.filter((v) => v.routeStatus === 'IN_ROUTE').length,
      withPlan: withPlan.length,
      notStarted: withPlan.filter((v) => v.routeStatus === 'NOT_STARTED').length,
    };
  });

  protected popupCustomerId = signal<number | null>(null);
  protected popupData = signal<MapCustomerPopupView | null>(null);
  protected popupLoading = signal(false);
  protected popupError = signal(false);
  protected popupPosition = signal<{ x: number; y: number } | null>(null);

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private canvasRenderer: L.Canvas | null = null;
  private layerGroups: Record<LayerKey, L.LayerGroup> | null = null;
  private drawJob: { cancel: () => void } | null = null;

  constructor() {
    effect(() => {
      const date = this.date();
      untracked(() => this.load(date));
    });
  }

  private load(date: string) {
    this.loading.set(true);
    this.error.set(false);
    this.drawJob?.cancel();
    this.mapSvc.global(date).subscribe({
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
    this.canvasRenderer = L.canvas({ padding: 0.5 });
    this.layerGroups = {
      ordered: L.layerGroup().addTo(this.leafletMap),
      noOrder: L.layerGroup().addTo(this.leafletMap),
      closed: L.layerGroup().addTo(this.leafletMap),
      pending: L.layerGroup().addTo(this.leafletMap),
      idle: L.layerGroup().addTo(this.leafletMap),
    };
    this.leafletMap.on('click', () => this.closePopup());
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private layerKeyFor(p: MapGlobalPointView): LayerKey {
    if (p.status === 'ORDERED') return 'ordered';
    if (p.status === 'NO_ORDER') return 'noOrder';
    if (p.status === 'CLOSED') return 'closed';
    if (p.scheduled) return 'pending';
    return 'idle';
  }

  private redraw() {
    const map = this.leafletMap;
    const groups = this.layerGroups;
    const renderer = this.canvasRenderer;
    const data = this.data();
    if (!map || !groups || !renderer || !data) return;

    for (const g of Object.values(groups)) g.clearLayers();

    const offPlanColor = resolveCssVar('--map-off-plan');
    const colors: Record<LayerKey, string> = {
      ordered: resolveCssVar('--map-status-ordered'),
      noOrder: resolveCssVar('--map-status-no-order'),
      closed: resolveCssVar('--map-status-closed'),
      pending: resolveCssVar('--map-status-pending'),
      idle: resolveCssVar('--map-status-idle'),
    };
    const radii: Record<LayerKey, number> = {
      ordered: 7,
      noOrder: 7,
      closed: 7,
      pending: 6,
      idle: 4,
    };

    this.drawing.set(true);
    this.drawProgress.set(0);
    const bounds: L.LatLngExpression[] = [];
    const drawPoints = data.points.map((p) => {
      const key = this.layerKeyFor(p);
      bounds.push([p.latitude, p.longitude]);
      return {
        lat: p.latitude,
        lng: p.longitude,
        radius: radii[key],
        fillColor: key === 'pending' ? '#ffffff' : colors[key],
        strokeColor: p.offPlan ? offPlanColor : key === 'pending' ? colors[key] : colors[key],
        strokeWeight: p.offPlan ? 2 : key === 'pending' ? 2 : 0.5,
        opacity: key === 'idle' ? 0.6 : 0.95,
        target: groups[key],
        customerId: p.customerId,
      };
    });

    void import('./map-markers').then(({ drawPointsInBatches }) => {
      this.drawJob = drawPointsInBatches(
        renderer,
        drawPoints,
        2000,
        (drawn, total) => this.drawProgress.set(Math.round((drawn / total) * 100)),
        () => {
          this.drawing.set(false);
          if (bounds.length > 0)
            map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 13 });
        },
        (customerId, ev) => this.openPopup(customerId, ev),
      );
    });

    this.applyLayerVisibility();
  }

  protected toggleLayer(key: LayerKey) {
    this.layerVisible.update((cur) => ({ ...cur, [key]: !cur[key] }));
    this.applyLayerVisibility();
  }

  protected toggleOnlyActiveToday() {
    this.onlyActiveToday.update((v) => !v);
    this.applyLayerVisibility();
  }

  private applyLayerVisibility() {
    if (!this.leafletMap || !this.layerGroups) return;
    for (const key of Object.keys(this.layerGroups) as LayerKey[]) {
      const group = this.layerGroups[key];
      const shouldShow =
        key === 'idle'
          ? this.layerVisible().idle && !this.onlyActiveToday()
          : this.layerVisible()[key];
      if (shouldShow && !this.leafletMap.hasLayer(group)) this.leafletMap.addLayer(group);
      if (!shouldShow && this.leafletMap.hasLayer(group)) this.leafletMap.removeLayer(group);
    }
  }

  protected goToVendor(userId: number) {
    this.router.navigate([], {
      queryParams: { view: null, vendor: String(userId) },
      queryParamsHandling: 'merge',
    });
  }

  protected openPopup(customerId: number, ev: L.LeafletMouseEvent) {
    if (!this.leafletMap) return;
    const point = this.leafletMap.latLngToContainerPoint(ev.latlng);
    this.popupPosition.set({ x: point.x, y: point.y });
    this.popupCustomerId.set(customerId);
    this.popupData.set(null);
    this.popupLoading.set(true);
    this.popupError.set(false);
    this.mapSvc.customerPopup(customerId, this.date()).subscribe({
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
