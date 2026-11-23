import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { AuthService } from '../../../core/auth/auth';
import { AssignmentAdminService } from '../assignment-admin';
import { AssignmentMapAdminService } from '../assignment-map-admin';
import { CreateAssignmentDialog } from '../ui/create-assignment-dialog';
import { MapCustomerPopup } from './customer-popup';
import { vendorPointIcon, orphanPointIcon } from './map-markers';
import {
  mapVendorColorVar,
  pointStatusInfo,
  routeStatusLabel,
  routeTimeRangeText,
} from '../map-format';
import { formatSoles } from '../../../shared/pipes/money';
import {
  MapCustomerPopupView,
  MapDayCounters,
  MapOverviewResponse,
  MapVendorSummary,
} from '../../../shared/models/assignment-map.models';
import { OrphanCustomerView } from '../../../shared/models/assignment-admin.models';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];

function emptyCounters(): MapDayCounters {
  return {
    planned: 0,
    pending: 0,
    visited: 0,
    ordered: 0,
    noOrder: 0,
    closed: 0,
    offPlan: 0,
    withoutLocation: 0,
    orderAmount: 0,
  };
}

/**
 * Vista general — doc 40, sección 5. Todos los vendedores a la vez, solo
 * con los clientes programados del día, sin agrupamiento (M1/M2/M6).
 */
@Component({
  selector: 'app-map-overview-view',
  imports: [UiEmpty, MapCustomerPopup],
  templateUrl: './overview-view.html',
  styleUrls: ['./overview-view.scss'],
})
export class MapOverviewView {
  private assignmentSvc = inject(AssignmentAdminService);
  private mapSvc = inject(AssignmentMapAdminService);
  private auth = inject(AuthService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);
  private injector = inject(Injector);

  overview = input<MapOverviewResponse | null>(null);
  loading = input(false);
  error = input(false);
  date = input('');
  retry = output<void>();
  selectVendor = output<number>();

  protected mapVendorColorVar = mapVendorColorVar;
  protected pointStatusInfo = pointStatusInfo;
  protected routeStatusLabel = routeStatusLabel;
  protected routeTimeRangeText = routeTimeRangeText;
  protected formatSoles = formatSoles;

  private hiddenKey = computed(
    () => `hds.map.hiddenVendors.${this.auth.currentUser()?.userId ?? 'anon'}`,
  );
  protected hiddenVendorIds = signal<Set<number>>(new Set());
  protected hoveredVendorId = signal<number | null>(null);

  protected vendors = computed(() => this.overview()?.vendors ?? []);
  protected vendorsWithPlan = computed(() => this.vendors().filter((v) => v.counters.planned > 0));
  protected vendorsWithoutPlan = computed(() =>
    this.vendors().filter((v) => v.counters.planned === 0),
  );
  protected visibleCount = computed(
    () => this.vendors().filter((v) => !this.hiddenVendorIds().has(v.userId)).length,
  );
  protected totalCount = computed(() => this.vendors().length);

  protected visibleTotals = computed<MapDayCounters>(() => {
    const hidden = this.hiddenVendorIds();
    const visible = this.vendors().filter((v) => !hidden.has(v.userId));
    if (visible.length === this.vendors().length) return this.overview()?.totals ?? emptyCounters();
    return visible.reduce((acc, v) => {
      acc.planned += v.counters.planned;
      acc.pending += v.counters.pending;
      acc.visited += v.counters.visited;
      acc.ordered += v.counters.ordered;
      acc.noOrder += v.counters.noOrder;
      acc.closed += v.counters.closed;
      acc.offPlan += v.counters.offPlan;
      acc.withoutLocation += v.counters.withoutLocation;
      acc.orderAmount += v.counters.orderAmount;
      return acc;
    }, emptyCounters());
  });
  protected onlyVisibleLabel = computed(() => this.visibleCount() < this.totalCount());
  protected visitedPercent = computed(() => {
    const t = this.visibleTotals();
    return t.planned > 0 ? Math.round((t.visited / t.planned) * 100) : 0;
  });

  protected sidePanelOpen = signal(false);

  protected orphanCount = computed(() => this.overview()?.orphanCount ?? 0);
  protected orphansLayerOn = signal(false);
  protected orphans = signal<OrphanCustomerView[]>([]);
  protected orphansLoading = signal(false);

  protected popupCustomerId = signal<number | null>(null);
  protected popupData = signal<MapCustomerPopupView | null>(null);
  protected popupLoading = signal(false);
  protected popupError = signal(false);
  protected popupPosition = signal<{ x: number; y: number } | null>(null);

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private vendorLayers = new Map<number, L.LayerGroup>();
  private orphanLayer: L.LayerGroup | null = null;
  private markerByCustomer = new Map<number, L.Marker>();
  private vendorOfMarker = new Map<number, number>();
  private firstDraw = true;

  constructor() {
    this.hiddenVendorIds.set(this.readHiddenVendors());

    effect(() => {
      const data = this.overview();
      untracked(() => {
        if (!data) return;
        if (!this.leafletMap) {
          afterNextRender(
            () => {
              this.ensureMap();
              this.drawAll(data);
            },
            { injector: this.injector },
          );
        } else {
          this.drawAll(data);
        }
      });
    });
  }

  private readHiddenVendors(): Set<number> {
    try {
      const raw = localStorage.getItem(this.hiddenKey());
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as number[]);
    } catch {
      return new Set();
    }
  }

  private saveHiddenVendors() {
    try {
      localStorage.setItem(this.hiddenKey(), JSON.stringify([...this.hiddenVendorIds()]));
    } catch {
      /* localStorage no disponible: no persiste entre sesiones */
    }
  }

  protected isHidden(userId: number): boolean {
    return this.hiddenVendorIds().has(userId);
  }

  protected toggleVendorVisibility(userId: number) {
    const next = new Set(this.hiddenVendorIds());
    next.has(userId) ? next.delete(userId) : next.add(userId);
    this.hiddenVendorIds.set(next);
    this.saveHiddenVendors();
    this.applyVisibility();
  }

  protected showAll() {
    this.hiddenVendorIds.set(new Set());
    this.saveHiddenVendors();
    this.applyVisibility();
  }

  protected hideAll() {
    this.hiddenVendorIds.set(new Set(this.vendors().map((v) => v.userId)));
    this.saveHiddenVendors();
    this.applyVisibility();
  }

  private applyVisibility() {
    if (!this.leafletMap) return;
    for (const [userId, layer] of this.vendorLayers) {
      const hidden = this.hiddenVendorIds().has(userId);
      if (hidden && this.leafletMap.hasLayer(layer)) this.leafletMap.removeLayer(layer);
      if (!hidden && !this.leafletMap.hasLayer(layer)) this.leafletMap.addLayer(layer);
    }
  }

  protected onVendorHoverEnter(userId: number) {
    this.hoveredVendorId.set(userId);
    for (const [customerId, marker] of this.markerByCustomer) {
      const owner = this.vendorOfMarker.get(customerId);
      marker.setOpacity(owner === userId ? 1 : 0.25);
    }
  }

  protected onVendorHoverLeave() {
    this.hoveredVendorId.set(null);
    for (const marker of this.markerByCustomer.values()) marker.setOpacity(1);
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
    this.leafletMap.on('click', () => this.closePopup());
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private drawAll(data: MapOverviewResponse) {
    if (!this.leafletMap) return;
    const map = this.leafletMap;
    const bounds: L.LatLngExpression[] = [];
    const seen = new Set<number>();

    for (const v of data.vendors) {
      if (!this.vendorLayers.has(v.userId)) {
        const layer = L.layerGroup();
        if (!this.hiddenVendorIds().has(v.userId)) layer.addTo(map);
        this.vendorLayers.set(v.userId, layer);
      }
    }

    for (const p of data.points) {
      seen.add(p.customerId);
      const colorVar = mapVendorColorVar(
        data.vendors.find((v) => v.userId === p.userId)?.mapColor ?? null,
      );
      const icon = vendorPointIcon(p.status, colorVar, p.offPlan);
      let marker = this.markerByCustomer.get(p.customerId);
      if (marker) {
        marker.setIcon(icon);
        marker.setLatLng([p.latitude, p.longitude]);
      } else {
        marker = L.marker([p.latitude, p.longitude], { icon });
        marker.on('click', (ev) => this.openPopup(p.customerId, ev));
        this.markerByCustomer.set(p.customerId, marker);
        const layer = p.userId != null ? this.vendorLayers.get(p.userId) : null;
        layer?.addLayer(marker);
      }
      if (p.userId != null) this.vendorOfMarker.set(p.customerId, p.userId);
      bounds.push([p.latitude, p.longitude]);
    }

    for (const [customerId, marker] of [...this.markerByCustomer]) {
      if (!seen.has(customerId)) {
        marker.remove();
        this.markerByCustomer.delete(customerId);
        this.vendorOfMarker.delete(customerId);
      }
    }

    if (this.firstDraw && bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 15 });
      this.firstDraw = false;
    }
  }

  protected toggleOrphans() {
    this.orphansLayerOn.update((v) => !v);
    if (!this.orphansLayerOn()) {
      this.orphanLayer?.clearLayers();
      return;
    }
    if (this.orphans().length === 0) {
      this.orphansLoading.set(true);
      this.assignmentSvc.orphans().subscribe({
        next: (list) => {
          this.orphans.set(list);
          this.orphansLoading.set(false);
          this.drawOrphans(list);
        },
        error: () => this.orphansLoading.set(false),
      });
    } else {
      this.drawOrphans(this.orphans());
    }
  }

  private drawOrphans(list: OrphanCustomerView[]) {
    if (!this.leafletMap) return;
    if (!this.orphanLayer) {
      this.orphanLayer = L.layerGroup().addTo(this.leafletMap);
    } else {
      this.orphanLayer.clearLayers();
    }
    for (const c of list) {
      if (c.latitude == null || c.longitude == null) continue;
      const marker = L.marker([c.latitude, c.longitude], { icon: orphanPointIcon() });
      marker.on('click', (ev) => this.openPopup(c.customerId, ev));
      this.orphanLayer.addLayer(marker);
    }
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

  protected onAssignVendor() {
    const d = this.popupData();
    if (!d) return;
    this.closePopup();
    this.dialog
      .open(CreateAssignmentDialog, {
        data: { fixedCustomer: { id: d.customerId, name: d.customerName, code: d.code } },
        width: '520px',
      })
      .afterClosed()
      .subscribe((created) => created && this.retry.emit());
  }
}
