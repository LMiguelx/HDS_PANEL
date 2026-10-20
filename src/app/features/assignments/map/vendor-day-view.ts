import {
  Component,
  DestroyRef,
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
import { UiButton } from '../../../shared/ui/button/button';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { ToastService } from '../../../core/ui/toast';
import { AssignmentMapAdminService } from '../assignment-map-admin';
import { MapCustomerPopup } from './customer-popup';
import { routeFlagIcon, stopPointIcon } from './map-markers';
import {
  alertLabel,
  alertSummaryText,
  distanceText,
  mapVendorColorVar,
  minutesText,
  orderStatusBadge,
  pointStatusInfo,
} from '../map-format';
import { formatSoles } from '../../../shared/pipes/money';
import { timeText } from '../assignment-format';
import {
  MapCustomerPopupView,
  MapLogEntryView,
  MapPointStatus,
  MapStopView,
  MapVendorDayResponse,
} from '../../../shared/models/assignment-map.models';

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];
type AlertFilter = 'all' | 'alerts';

type BitacoraLine =
  | { kind: 'start' }
  | { kind: 'pause'; minutes: number }
  | { kind: 'visit'; entry: MapLogEntryView; number: number }
  | { kind: 'end' };

/** Un vendedor: plan del día, recorrido real, bitácora y seguimiento — doc 40, secciones 6-7. */
@Component({
  selector: 'app-map-vendor-day-view',
  imports: [UiButton, UiEmpty, MapCustomerPopup],
  templateUrl: './vendor-day-view.html',
  styleUrls: ['./vendor-day-view.scss'],
})
export class MapVendorDayView {
  private mapSvc = inject(AssignmentMapAdminService);
  private toast = inject(ToastService);
  private injector = inject(Injector);

  userId = input.required<number>();
  date = input('');

  protected mapVendorColorVar = mapVendorColorVar;
  protected pointStatusInfo = pointStatusInfo;
  protected alertLabel = alertLabel;
  protected alertSummaryText = alertSummaryText;
  protected distanceText = distanceText;
  protected minutesText = minutesText;
  protected orderStatusBadge = orderStatusBadge;
  protected formatSoles = formatSoles;
  protected timeText = timeText;

  protected data = signal<MapVendorDayResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected isToday = computed(() => this.date() === this.todayIso());

  protected alertFilter = signal<AlertFilter>('all');
  protected playheadMs = signal<number | null>(null); // null = estado normal (no reproduciendo)

  protected popupCustomerId = signal<number | null>(null);
  protected popupData = signal<MapCustomerPopupView | null>(null);
  protected popupLoading = signal(false);
  protected popupError = signal(false);
  protected popupPosition = signal<{ x: number; y: number } | null>(null);
  protected popupTrackingExtra = signal<{
    distanceMeters: number;
    order: number;
    time: string;
  } | null>(null);

  protected numberByCustomer = computed<Map<number, number>>(() => {
    const log = this.data()?.log ?? [];
    const map = new Map<number, number>();
    log.forEach((e, i) => map.set(e.customerId, i + 1));
    return map;
  });

  protected timelineBounds = computed(() => {
    const v = this.data()?.vendor;
    if (!v?.routeStartedAt) return null;
    const start = new Date(v.routeStartedAt).getTime();
    const end = v.routeEndedAt ? new Date(v.routeEndedAt).getTime() : Date.now();
    return { start, end: Math.max(end, start + 1) };
  });
  protected effectivePlayheadMs = computed(
    () => this.playheadMs() ?? this.timelineBounds()?.end ?? 0,
  );
  protected isScrubbing = computed(() => {
    const bounds = this.timelineBounds();
    return bounds != null && this.playheadMs() != null && this.playheadMs()! < bounds.end;
  });

  protected visitTicks = computed(() => {
    const bounds = this.timelineBounds();
    if (!bounds) return [];
    const span = bounds.end - bounds.start || 1;
    return (this.data()?.log ?? []).map((e) => ({
      pct: Math.min(
        100,
        Math.max(0, ((new Date(e.visitedAt).getTime() - bounds.start) / span) * 100),
      ),
      colorVar: `var(${this.statusDotVar(e.status)})`,
      hasAlert: e.alerts.length > 0,
    }));
  });

  protected bitacoraLines = computed<BitacoraLine[]>(() => {
    const d = this.data();
    if (!d) return [];
    const lines: BitacoraLine[] = [];
    if (d.vendor.routeStartedAt) lines.push({ kind: 'start' });
    const numbers = this.numberByCustomer();
    for (const entry of d.log) {
      if (entry.alerts.includes('LONG_PAUSE')) {
        lines.push({ kind: 'pause', minutes: entry.minutesSincePrevious ?? 0 });
      }
      lines.push({ kind: 'visit', entry, number: numbers.get(entry.customerId) ?? 0 });
    }
    lines.push({ kind: 'end' });
    return lines;
  });

  protected filteredBitacoraLines = computed(() => {
    const lines = this.bitacoraLines();
    if (this.alertFilter() === 'all') return lines;
    return lines.filter(
      (l) => l.kind === 'pause' || (l.kind === 'visit' && l.entry.alerts.length > 0),
    );
  });

  protected pendingStops = computed(() =>
    (this.data()?.stops ?? [])
      .filter((s) => s.status === 'PENDING')
      .sort((a, b) => (a.routeSequence ?? 999) - (b.routeSequence ?? 999)),
  );
  protected showPendingList = signal(false);

  protected visitedPercent = computed(() => {
    const c = this.data()?.vendor.counters;
    return c && c.planned > 0 ? Math.round((c.visited / c.planned) * 100) : 0;
  });

  protected closingLabel = computed(() => {
    const v = this.data()?.vendor;
    if (!v) return '';
    if (v.routeStatus === 'IN_ROUTE') {
      return `Ruta en curso · Quedan ${v.counters.pending} clientes programados por visitar`;
    }
    if (v.routeStatus === 'FINISHED') {
      return `Fin de ruta · ${v.routeEndedAt ? timeText(v.routeEndedAt) : ''}`;
    }
    return 'El vendedor no inició ruta';
  });

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private markerByCustomer = new Map<number, L.Marker>();
  private pathLayer: L.Polyline | null = null;
  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;
  private firstDraw = true;

  constructor() {
    effect(() => {
      const userId = this.userId();
      const date = this.date();
      untracked(() => this.loadDay(userId, date));
    });

    effect(() => {
      this.playheadMs();
      untracked(() => this.applyPlayhead());
    });

    const intervalId = setInterval(() => {
      if (this.isToday() && document.visibilityState === 'visible' && !this.isScrubbing()) {
        this.pollTrack();
      }
    }, 120_000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private statusDotVar(status: MapPointStatus): string {
    switch (status) {
      case 'ORDERED':
        return '--map-status-ordered';
      case 'NO_ORDER':
        return '--map-status-no-order';
      case 'CLOSED':
        return '--map-status-closed';
      default:
        return '--map-status-pending';
    }
  }

  private loadDay(userId: number, date: string) {
    this.loading.set(true);
    this.error.set(false);
    this.firstDraw = true;
    this.playheadMs.set(null);
    this.mapSvc.vendorDay(userId, date).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
        if (!this.leafletMap) {
          afterNextRender(
            () => {
              this.ensureMap();
              this.redrawAll();
            },
            { injector: this.injector },
          );
        } else {
          this.redrawAll();
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected refresh() {
    this.loadDay(this.userId(), this.date());
  }

  private pollTrack() {
    const d = this.data();
    if (!d) return;
    this.mapSvc.vendorTrack(this.userId(), this.date(), d.lastVisitId).subscribe({
      next: (res) => {
        if (res.reloadRequired) {
          this.loadDay(this.userId(), this.date());
          return;
        }
        this.applyTrack(res);
      },
      error: () => {
        /* el refresco en curso falla en silencio; se reintenta en el siguiente ciclo (sección 13.1) */
      },
    });
  }

  private applyTrack(
    track: import('../../../shared/models/assignment-map.models').MapVendorTrackResponse,
  ) {
    const current = this.data();
    if (!current) return;
    const stopsById = new Map(current.stops.map((s) => [s.customerId, s]));
    for (const changed of track.changedStops) stopsById.set(changed.customerId, changed);
    const merged: MapVendorDayResponse = {
      ...current,
      vendor: track.vendor,
      stops: [...stopsById.values()],
      path: track.path,
      log: [...current.log, ...track.newEntries],
      alerts: track.alerts,
      currentPauseMinutes: track.currentPauseMinutes,
      idleAlert: track.idleAlert,
      lastVisitId: track.lastVisitId,
    };
    this.data.set(merged);
    this.redrawAll();
    if (track.newEntries.length > 0) {
      this.toast.info(`${track.newEntries.length} visitas nuevas de ${track.vendor.userName}.`);
    }
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

  private redrawAll() {
    if (!this.leafletMap) return;
    const map = this.leafletMap;
    const d = this.data();
    if (!d) return;
    const colorVar = mapVendorColorVar(d.vendor.mapColor);
    const seen = new Set<number>();
    const bounds: L.LatLngExpression[] = [];
    const numbers = this.numberByCustomer();

    for (const s of d.stops) {
      if (s.latitude == null || s.longitude == null) continue;
      seen.add(s.customerId);
      const foreignVisit = s.lastVisitUserId != null && s.lastVisitUserId !== d.vendor.userId;
      const number = foreignVisit ? null : (numbers.get(s.customerId) ?? null);
      const icon = stopPointIcon(s.status, number, s.offPlan || foreignVisit);
      let marker = this.markerByCustomer.get(s.customerId);
      if (marker) {
        marker.setIcon(icon);
      } else {
        marker = L.marker([s.latitude, s.longitude], { icon });
        marker.on('click', (ev) => this.openPopupFromMarker(s.customerId, ev));
        this.markerByCustomer.set(s.customerId, marker);
        marker.addTo(map);
      }
      bounds.push([s.latitude, s.longitude]);
    }
    for (const [customerId, marker] of [...this.markerByCustomer]) {
      if (!seen.has(customerId)) {
        marker.remove();
        this.markerByCustomer.delete(customerId);
      }
    }

    const pathPoints = d.path.map((p) => [p.latitude, p.longitude] as [number, number]);
    if (!this.pathLayer) {
      this.pathLayer = L.polyline(pathPoints, {
        color: colorVar,
        weight: 3,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    } else {
      this.pathLayer.setLatLngs(pathPoints);
      this.pathLayer.setStyle({ color: colorVar });
    }

    const start = d.path.find((p) => p.kind === 'START');
    const end = d.path.find((p) => p.kind === 'END');
    if (start) {
      if (!this.startMarker) {
        this.startMarker = L.marker([start.latitude, start.longitude], {
          icon: routeFlagIcon('start', colorVar),
        }).addTo(map);
      } else {
        this.startMarker.setLatLng([start.latitude, start.longitude]);
      }
      bounds.push([start.latitude, start.longitude]);
    }
    if (end) {
      if (!this.endMarker) {
        this.endMarker = L.marker([end.latitude, end.longitude], {
          icon: routeFlagIcon('end', colorVar),
        }).addTo(map);
      } else {
        this.endMarker.setLatLng([end.latitude, end.longitude]);
      }
      bounds.push([end.latitude, end.longitude]);
    }

    if (this.firstDraw && bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 15 });
      this.firstDraw = false;
    }
    this.applyPlayhead();
  }

  private applyPlayhead() {
    const d = this.data();
    const bounds = this.timelineBounds();
    if (!d || !bounds) return;
    const t = this.effectivePlayheadMs();
    const numbers = this.numberByCustomer();

    const clipped = d.path.filter((p) => new Date(p.at).getTime() <= t);
    this.pathLayer?.setLatLngs(clipped.map((p) => [p.latitude, p.longitude] as [number, number]));

    for (const s of d.stops) {
      const marker = this.markerByCustomer.get(s.customerId);
      if (!marker) continue;
      const visitedBefore = s.lastVisitAt != null && new Date(s.lastVisitAt).getTime() <= t;
      const foreignVisit = s.lastVisitUserId != null && s.lastVisitUserId !== d.vendor.userId;
      const status = visitedBefore ? s.status : 'PENDING';
      const number = visitedBefore && !foreignVisit ? (numbers.get(s.customerId) ?? null) : null;
      marker.setIcon(stopPointIcon(status, number, visitedBefore && (s.offPlan || foreignVisit)));
    }
  }

  protected onScrub(ev: Event) {
    const value = Number((ev.target as HTMLInputElement).value);
    const bounds = this.timelineBounds();
    if (!bounds) return;
    this.playheadMs.set(value >= bounds.end ? null : value);
  }

  protected seekToStart() {
    const bounds = this.timelineBounds();
    if (bounds) this.playheadMs.set(bounds.start);
  }

  protected seekToEnd() {
    this.playheadMs.set(null);
  }

  protected focusLogEntry(entry: MapLogEntryView) {
    const marker = this.markerByCustomer.get(entry.customerId);
    if (marker && this.leafletMap) {
      this.leafletMap.setView(marker.getLatLng(), Math.max(this.leafletMap.getZoom(), 15));
    }
    const extra =
      entry.distanceMeters != null
        ? {
            distanceMeters: entry.distanceMeters,
            order: this.numberByCustomer().get(entry.customerId) ?? 0,
            time: timeText(entry.visitedAt),
          }
        : null;
    this.openPopup(entry.customerId, marker?.getLatLng() ?? null, extra);
  }

  protected openPopupFromMarker(customerId: number, ev: L.LeafletMouseEvent) {
    this.openPopup(customerId, ev.latlng, null);
  }

  protected focusPendingStop(stop: MapStopView) {
    this.showPendingList.set(false);
    const marker = this.markerByCustomer.get(stop.customerId);
    if (marker && this.leafletMap) {
      this.leafletMap.setView(marker.getLatLng(), Math.max(this.leafletMap.getZoom(), 15));
    }
    this.openPopup(stop.customerId, marker?.getLatLng() ?? null, null);
  }

  private openPopup(
    customerId: number,
    latlng: L.LatLng | null,
    trackingExtra: { distanceMeters: number; order: number; time: string } | null,
  ) {
    if (!this.leafletMap) return;
    const point = latlng
      ? this.leafletMap.latLngToContainerPoint(latlng)
      : this.markerByCustomer.get(customerId)
        ? this.leafletMap.latLngToContainerPoint(this.markerByCustomer.get(customerId)!.getLatLng())
        : null;
    if (!point) return;
    this.popupPosition.set({ x: point.x, y: point.y });
    this.popupCustomerId.set(customerId);
    this.popupData.set(null);
    this.popupLoading.set(true);
    this.popupError.set(false);
    this.popupTrackingExtra.set(trackingExtra);
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
    this.popupTrackingExtra.set(null);
  }
}
