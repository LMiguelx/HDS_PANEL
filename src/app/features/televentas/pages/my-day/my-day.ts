import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import * as L from 'leaflet';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiTabs, UiTabItem } from '../../../../shared/ui/tabs/tabs';
import { UiStatus } from '../../../../shared/ui/status/status';
import { UiDialogService } from '../../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../../core/ui/toast';
import { TelesalesDayStore } from '../../data-access/televentas.store';
import { RouteStore } from '../../../orders/route-store';
import { CustomerService } from '../../../customers/customer';
import { OrderAdminService } from '../../../orders/order-admin';
import { CustomerDetail, CustomerSummary } from '../../../../shared/models/customer.models';
import { OrderSummary } from '../../../../shared/models/order.models';
import { resolveCssVar } from '../../../assignments/map/map-markers';
import { scheduleText } from '../../../assignments/map-format';
import { dateText, dateTimeText } from '../../../assignments/assignment-format';
import { formatSoles } from '../../../../shared/pipes/money';
import { ratingText } from '../../../customers/customer-format';
import { visitStatusInfo } from '../../domain/televentas.format';
import { orderStatusName } from '../../../orders/order-format';
import { RegisterCallDialog, RegisterCallDialogData } from '../../dialogs/register-call.dialog';

interface DayRow {
  customerId: number;
  assignmentId: number;
  isCoverage: boolean;
  isToday: boolean;
  schedule: string | null; // solo en Cartera completa
  summary: CustomerSummary;
}

const TABS: UiTabItem[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'cartera', label: 'Cartera completa' },
];

const STATUS_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'ATTENDED', label: 'Compró' },
  { value: 'NO_PURCHASE', label: 'No compró' },
  { value: 'CLOSED', label: 'Cerrado' },
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];

/**
 * Mi día — doc 42, sección 6. Pantalla de inicio del modo televentas: a
 * quién llamar hoy, cómo va cada cliente y, al elegir uno, todo para la
 * llamada en el mismo lugar (sección 2.1 — nada de cambiar de pantalla).
 */
@Component({
  selector: 'app-my-day',
  imports: [UiButton, UiField, UiEmpty, UiTabs, UiStatus],
  templateUrl: './my-day.html',
  styleUrls: ['./my-day.scss'],
})
export class MyDayPage {
  protected store = inject(TelesalesDayStore);
  protected routeStore = inject(RouteStore);
  private customerSvc = inject(CustomerService);
  private orderSvc = inject(OrderAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private breakpoints = inject(BreakpointObserver);
  private injector = inject(Injector);

  protected tabs = TABS;
  protected statusOptions = STATUS_FILTER_OPTIONS;
  protected visitStatusInfo = visitStatusInfo;
  protected ratingText = ratingText;
  protected dateTimeText = dateTimeText;
  protected formatSoles = formatSoles;
  protected orderStatusName = orderStatusName;

  protected activeTab = signal<'hoy' | 'cartera'>('hoy');
  protected search = signal('');
  protected statusFilter = signal('');
  protected mobileView = signal<'list' | 'map'>('list');

  protected isNarrow = toSignal(
    this.breakpoints.observe(['(max-width: 1199px)']).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected jornadaOpen = computed(
    () => !!this.routeStore.route() && !this.routeStore.route()!.endTime,
  );

  private todayCustomerIds = computed(() => new Set(this.store.plan().map((s) => s.customerId)));

  protected todayRows = computed<DayRow[]>(() => {
    const portfolioMap = new Map(this.store.portfolio().map((c) => [c.customerId, c]));
    const coverageMap = new Map(this.store.coverage().map((c) => [c.customerId, c]));
    const rows: DayRow[] = [];
    for (const stop of this.store.plan()) {
      const summary = portfolioMap.get(stop.customerId) ?? coverageMap.get(stop.customerId);
      if (!summary) continue;
      rows.push({
        customerId: stop.customerId,
        assignmentId: stop.assignmentId,
        isCoverage: stop.isCoverage,
        isToday: true,
        schedule: null,
        summary,
      });
    }
    return rows;
  });

  protected carteraRows = computed<DayRow[]>(() => {
    const assignMap = new Map(this.store.fullAssignments().map((a) => [a.customerId, a]));
    const todayIds = this.todayCustomerIds();
    return this.store.portfolio().map((summary) => {
      const a = assignMap.get(summary.customerId);
      return {
        customerId: summary.customerId,
        assignmentId: a?.assignmentId ?? 0,
        isCoverage: false,
        isToday: todayIds.has(summary.customerId),
        schedule: a ? scheduleText(a.weekdays, a.weeksOfCycle) : 'Sin horario',
        summary,
      };
    });
  });

  protected visibleRows = computed<DayRow[]>(() => {
    const rows = this.activeTab() === 'hoy' ? this.todayRows() : this.carteraRows();
    const q = normalize(this.search());
    const status = this.statusFilter();
    return rows.filter((r) => {
      if (status && (r.summary.visitStatusCode ?? 'PENDING') !== status) return false;
      if (!q) return true;
      return (
        normalize(r.summary.businessName).includes(q) ||
        normalize(r.summary.code).includes(q) ||
        normalize(r.summary.documentNumber).includes(q)
      );
    });
  });

  /**
   * Fila de indicadores (sección 6.2): siempre "de los clientes de hoy",
   * no de la pestaña activa. Cerrado se suma a "No compró": el mockup no
   * trae una columna propia y el total (42) tiene que cuadrar con las tres.
   */
  protected kpis = computed(() => {
    const rows = this.todayRows();
    let pending = 0;
    let attended = 0;
    let noPurchase = 0;
    for (const r of rows) {
      const code = r.summary.visitStatusCode ?? 'PENDING';
      if (code === 'ATTENDED') attended++;
      else if (code === 'NO_PURCHASE' || code === 'CLOSED') noPurchase++;
      else pending++;
    }
    return {
      total: rows.length,
      pending,
      attended,
      noPurchase,
      ventaHoy: this.store.dailySummary()?.totalNetAmount ?? 0,
    };
  });

  /** "martes 20/10/2026" — hora local, nunca `toISOString()` para "hoy" (sección 8.2 del sistema de diseño). */
  protected headerDateLabel = computed(() => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const weekday = new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(today);
    return `${weekday} ${dateText(iso)}`;
  });

  // — Panel del cliente —
  protected selectedCustomerId = signal<number | null>(null);
  protected selectedAssignmentId = signal<number>(0);
  protected customerDetail = signal<CustomerDetail | null>(null);
  protected customerDetailLoading = signal(false);
  protected customerDetailError = signal(false);
  protected todayOrderId = signal<number | null>(null);

  protected historyOpen = signal(false);
  protected historyRows = signal<OrderSummary[]>([]);
  protected historyLoading = signal(false);

  private leafletMap: L.Map | null = null;
  private markersById = new Map<number, L.Marker>();
  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  protected hoveredCustomerId = signal<number | null>(null);

  constructor() {
    this.store.ensureLoaded();

    toObservable(this.selectedCustomerId)
      .pipe(
        switchMap((customerId) => {
          if (!customerId) return of(null);
          this.customerDetailLoading.set(true);
          this.customerDetailError.set(false);
          this.historyOpen.set(false);
          return this.customerSvc.detail(customerId).pipe(catchError(() => of(undefined)));
        }),
      )
      .subscribe((detail) => {
        this.customerDetailLoading.set(false);
        if (detail === undefined) {
          this.customerDetailError.set(true);
          this.customerDetail.set(null);
          return;
        }
        this.customerDetail.set(detail);
      });

    toObservable(this.selectedCustomerId)
      .pipe(
        switchMap((customerId) => {
          this.todayOrderId.set(null);
          if (!customerId) return of(null);
          return this.orderSvc
            .byCustomer(customerId, { page: 0, size: 1 })
            .pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((page) => {
        const first = page?.content[0];
        if (first && this.isToday(first.orderDate) && first.statusCode !== 'CANCELLED') {
          this.todayOrderId.set(first.orderId);
        }
      });

    effect(() => {
      const rows = this.visibleRows();
      untracked(() => {
        if (!this.leafletMap) {
          afterNextRender(
            () => {
              this.ensureMap();
              this.redrawMap(rows);
            },
            { injector: this.injector },
          );
        } else {
          this.redrawMap(rows);
        }
      });
    });
  }

  private isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  protected refresh() {
    this.store.refresh();
  }

  protected switchTab(tab: string) {
    this.activeTab.set(tab === 'cartera' ? 'cartera' : 'hoy');
    if (tab === 'cartera') this.store.ensureFullAssignmentsLoaded();
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
    this.leafletMap.on('click', () => this.selectedCustomerId.set(null));
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private markerIcon(row: DayRow): L.DivIcon {
    const info = visitStatusInfo(row.summary.visitStatusCode);
    const color = resolveCssVar(info.colorVar);
    const pending = (row.summary.visitStatusCode ?? 'PENDING') === 'PENDING';
    const size = 14;
    const fill = pending ? `background:#fff;border:2.5px solid ${color};` : `background:${color};`;
    return L.divIcon({
      className: 'md-point',
      html: `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size}px;height:${size}px;border-radius:50%;${fill}box-sizing:border-box;box-shadow:0 0 0 1.5px #fff;"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  private redrawMap(rows: DayRow[]) {
    const map = this.leafletMap;
    if (!map) return;
    const withCoords = rows.filter((r) => r.summary.latitude != null && r.summary.longitude != null);
    const seen = new Set<number>();
    const bounds: L.LatLngExpression[] = [];
    for (const row of withCoords) {
      seen.add(row.customerId);
      const latlng: L.LatLngExpression = [row.summary.latitude!, row.summary.longitude!];
      bounds.push(latlng);
      let marker = this.markersById.get(row.customerId);
      if (!marker) {
        marker = L.marker(latlng, { icon: this.markerIcon(row) }).addTo(map);
        marker.on('click', () => this.selectCustomer(row));
        this.markersById.set(row.customerId, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setIcon(this.markerIcon(row));
      }
    }
    for (const [id, marker] of this.markersById) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        this.markersById.delete(id);
      }
    }
    if (bounds.length > 0 && !this.hasFitBounds) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 14 });
      this.hasFitBounds = true;
    }
  }
  private hasFitBounds = false;

  protected onRowHoverEnter(customerId: number) {
    this.hoveredCustomerId.set(customerId);
    for (const [id, marker] of this.markersById) {
      marker.setOpacity(id === customerId ? 1 : 0.35);
    }
  }
  protected onRowHoverLeave() {
    this.hoveredCustomerId.set(null);
    for (const marker of this.markersById.values()) marker.setOpacity(1);
  }

  protected selectCustomer(row: DayRow) {
    this.selectedCustomerId.set(row.customerId);
    this.selectedAssignmentId.set(row.assignmentId);
    this.mobileView.set('map');
  }

  protected closeCustomerPanel() {
    this.selectedCustomerId.set(null);
  }

  protected selectedRow = computed(() => {
    const id = this.selectedCustomerId();
    if (!id) return null;
    return this.visibleRows().find((r) => r.customerId === id) ?? null;
  });

  protected canTakeOrder = computed(() => {
    const d = this.customerDetail();
    return !!d && d.isActive && d.customerTypeId != null;
  });

  protected takeOrderBlockedReason = computed(() => {
    const d = this.customerDetail();
    if (!d) return '';
    if (!d.isActive) return 'El cliente está inactivo';
    if (d.customerTypeId == null) return 'El cliente no tiene tipo asignado; comuníquese con supervisión';
    return '';
  });

  protected takeOrder() {
    const customerId = this.selectedCustomerId();
    const assignmentId = this.selectedAssignmentId();
    if (!customerId) return;
    this.router.navigate(['/televentas/nuevo-pedido'], {
      queryParams: { customerId, assignmentId: assignmentId || undefined },
    });
  }

  protected viewTodayOrder() {
    const orderId = this.todayOrderId();
    if (orderId) this.router.navigate(['/pedidos/detalle', orderId]);
  }

  protected openRegisterCall() {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<RegisterCallDialog, RegisterCallDialogData, unknown>(RegisterCallDialog, {
        data: {
          customerId: row.customerId,
          customerName: row.summary.businessName,
          assignmentId: row.assignmentId,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.toast.success('Llamada registrada.');
        this.store.markCalled(row.customerId);
        this.store.refreshAfterAction();
      });
  }

  protected toggleHistory() {
    const id = this.selectedCustomerId();
    if (!id) return;
    const opening = !this.historyOpen();
    this.historyOpen.set(opening);
    if (opening) {
      this.historyLoading.set(true);
      this.orderSvc.byCustomer(id, { page: 0, size: 10 }).subscribe({
        next: (page) => {
          this.historyRows.set(page.content ?? []);
          this.historyLoading.set(false);
        },
        error: () => this.historyLoading.set(false),
      });
    }
  }

  protected goToOrder(orderId: number) {
    this.router.navigate(['/pedidos/detalle', orderId]);
  }

  /** Teléfono siempre copiable (sección 2.1): en Electron `tel:` no marca. */
  protected copyPhone(phone: string | null) {
    if (!phone) return;
    navigator.clipboard
      .writeText(phone)
      .then(() => this.toast.success('Teléfono copiado.'))
      .catch(() => undefined);
  }

  protected calledThisSession(customerId: number): boolean {
    return this.store.calledThisSession().has(customerId);
  }
}
