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
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../promos/lookup';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CoverageDialog } from './ui/coverage-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { MapCustomerView, VendorOnRouteView } from '../../shared/models/assignment-admin.models';
import { visitStatusColorVar, visitStatusLabel } from './assignment-format';

// Paleta categórica fija para identificar vendedores (borde de sus clientes y
// punto de inicio de ruta) — no depende del tema claro/oscuro: son colores de
// datos, no de superficie. Se recicla por módulo si hay más vendedores que
// colores.
const PALETTE = [
  '#ec3013',
  '#1d4ed8',
  '#0d6b3f',
  '#8a5a00',
  '#7c3aed',
  '#0f8f8f',
  '#be185d',
  '#4b5563',
  '#065f46',
  '#b45309',
];
const ORPHAN_COLOR = '#201e1d';
const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];

function parseIds(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Leaflet pinta sus paths como atributos SVG, no CSS: `var()` no se resuelve ahí.
 * Se lee el valor calculado del token en el tema actual (claro/oscuro). */
function resolveCssVar(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || '#888888';
}

/** Pin de "inicio de ruta" (distinto de los círculos de seguimiento) — SVG inline, sin assets. */
function vendorStartIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'map-vendor-start-icon',
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#1a1918" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  });
}

/**
 * Mapa de cartera (GET /api/admin/assignments/map). El endpoint nunca se
 * llama sin filtro: hace falta elegir vendedores y/o huérfanos antes de
 * pintar nada. Sin bounding box ni clustering (fuera de alcance a propósito).
 *
 * Colores: el borde de cada punto identifica al vendedor (o huérfano, borde
 * punteado); el relleno identifica el estado de la visita de hoy
 * (gris = sin visita, o el color ya usado en el resto del sistema para
 * Atendido/Cerrado/No compró). El punto de inicio de ruta de cada vendedor
 * se pinta como un pin, distinto de los círculos de seguimiento.
 */
@Component({
  selector: 'app-assignment-map',
  imports: [UiButton, UiToggle, UiTypeahead, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="map-page">
      <div class="map-head">
        <h1>Mapa de cartera</h1>
        <p class="map-sub">
          Elige uno o varios vendedores, o huérfanos. Con un único vendedor se traza su ruta de hoy.
        </p>
      </div>

      <div class="map-picker">
        <div class="map-picker-row">
          <ui-typeahead
            label="Agregar vendedor"
            placeholder="Busca por nombre"
            [clearOnPick]="true"
            [search]="userSearch"
            (picked)="addVendor($event)"
          />
          <ui-toggle label="Incluir huérfanos" [(checked)]="orphansOnlyToggle" />
          <button uiButton variant="primary" (click)="applyPicker()">
            {{ queried() ? 'Actualizar mapa' : 'Ver mapa' }}
          </button>
        </div>

        @if (pickedVendors().length > 0) {
          <div class="map-picked-chips">
            @for (v of pickedVendors(); track v.id) {
              <span class="map-picked-chip" [style.--chip-color]="colorFor(v.id)">
                {{ v.name }}
                <button type="button" aria-label="Quitar" (click)="removeVendor(v.id)">✕</button>
              </span>
            }
          </div>
        }

        @if (pickerError()) {
          <div class="map-picker-error">{{ pickerError() }}</div>
        }
      </div>

      @if (queried()) {
        <div class="map-chips">
          <button type="button" class="map-chip" [class.on]="isAllActive()" (click)="showAll()">
            Todos
          </button>
          @for (chip of chipKeys(); track chip.key) {
            <button
              type="button"
              class="map-chip"
              [class.on]="activeFilterKeys().has(chip.key)"
              [style.--chip-color]="chip.color"
              [class.dashed]="chip.dashed"
              (click)="toggleChip(chip.key)"
            >
              <span class="map-chip-dot"></span>
              {{ chip.label }}
            </button>
          }

          @if (soloVendorId() !== null) {
            <button
              uiButton
              variant="secondary"
              size="sm"
              class="map-cover-btn"
              (click)="openCoverage()"
            >
              Cubrir cartera de {{ vendorNameFor(soloVendorId()!) }}
            </button>
          }
        </div>

        <div class="map-status-legend">
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-none"></span>Sin visita hoy</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-attended"></span>Atendido</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-closed"></span>Cerrado</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-no-purchase"></span>No compró</span
          >
          <span class="map-legend-item map-legend-note">El borde identifica al vendedor</span>
        </div>

        @if (loadedUserIds().length > 1) {
          <p class="map-route-hint">Para trazar la ruta, consulta un solo vendedor a la vez.</p>
        }

        @if (loading()) {
          <div class="map-skeleton" role="status" aria-label="Cargando mapa"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el mapa"
            body="Intenta de nuevo en unos segundos."
            actionLabel="Reintentar"
            (action)="reload()"
          />
        }

        <div class="map-canvas" [class.map-canvas-hidden]="loading() || error()" #mapEl></div>

        @if (!loading() && !error() && visibleCustomers().length === 0) {
          <p class="map-empty-note">No hay clientes con esos filtros para mostrar.</p>
        }
      } @else {
        <ui-empty
          title="Todavía no elegiste un filtro"
          body="El mapa no se puede cargar sin vendedores u huérfanos elegidos — son ~10 mil clientes en el tenant."
        />
      }
    </section>
  `,
  styles: [
    `
      .map-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .map-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
        max-width: 640px;
      }
      .map-picker {
        margin-top: 20px;
        padding-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .map-picker-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 12px;
        align-items: end;
      }
      .map-picked-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .map-picked-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 800;
        padding: 4px 6px 4px 10px;
        border: 1px solid var(--chip-color, var(--divider));
        color: var(--chip-color, var(--ink));
      }
      .map-picked-chip button {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 12px;
        padding: 2px;
      }
      .map-picker-error {
        margin-top: 8px;
        font-size: 13px;
        color: var(--accent-ink);
      }
      .map-chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
      }
      .map-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        appearance: none;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink-muted);
        min-height: 36px;
        padding: 0 14px;
      }
      .map-chip.on {
        color: var(--ink);
        border-color: var(--chip-color, var(--ink));
      }
      .map-chip-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--chip-color, currentColor);
      }
      .map-chip.dashed .map-chip-dot {
        background: transparent;
        border: 2px dashed var(--chip-color, currentColor);
      }
      .map-cover-btn {
        margin-left: auto;
      }
      .map-status-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
        margin-top: 10px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .map-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .map-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .map-legend-none {
        background: var(--ink-muted);
        opacity: 0.5;
      }
      .map-legend-attended {
        background: var(--st-attended);
      }
      .map-legend-closed {
        background: var(--st-closed);
      }
      .map-legend-no-purchase {
        background: var(--st-no-purchase);
      }
      .map-legend-note {
        font-style: italic;
      }
      .map-route-hint {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .map-skeleton {
        height: 480px;
        background: var(--faint);
        margin-top: 16px;
      }
      .map-canvas {
        height: 480px;
        margin-top: 16px;
        border: 1px solid var(--hairline);
      }
      .map-canvas-hidden {
        display: none;
      }
      .map-empty-note {
        margin: 12px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }

      @media (max-width: 900px) {
        .map-picker-row {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .map-page {
          padding: var(--sp-4);
        }
        .map-canvas,
        .map-skeleton {
          height: 380px;
        }
      }
    `,
  ],
})
export class AssignmentMapPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private lookupSvc = inject(LookupService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);

  // Ligados a los query params de la ruta (withComponentInputBinding), así
  // los enlaces desde Ausencias/Huérfanos ("Ver en mapa") disparan la carga.
  userIds = input('', { alias: 'userIds' });
  orphansOnly = input('', { alias: 'orphansOnly' });

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  protected pickedVendors = signal<UiLookupItem[]>([]);
  protected orphansOnlyToggle = signal(false);
  protected pickerError = signal('');

  protected queried = signal(false);
  protected loading = signal(false);
  protected error = signal(false);
  protected customers = signal<MapCustomerView[]>([]);
  protected vendorStarts = signal<VendorOnRouteView[]>([]);
  protected loadedUserIds = signal<number[]>([]);
  protected loadedOrphansOnly = signal(false);
  protected activeFilterKeys = signal<Set<string>>(new Set());

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private routeLayer: L.Polyline | null = null;

  protected chipKeys = computed(() => {
    const chips = this.loadedUserIds().map((id) => ({
      key: `v:${id}`,
      label: this.vendorNameFor(id),
      color: this.colorFor(id),
      dashed: false,
    }));
    if (this.loadedOrphansOnly() || this.customers().some((c) => c.userId == null)) {
      chips.push({ key: 'orphans', label: 'Huérfanos', color: ORPHAN_COLOR, dashed: true });
    }
    return chips;
  });

  protected isAllActive = computed(() => this.activeFilterKeys().size === this.chipKeys().length);

  protected soloVendorId = computed(() =>
    this.loadedUserIds().length === 1 && !this.loadedOrphansOnly() ? this.loadedUserIds()[0] : null,
  );

  protected visibleCustomers = computed(() => {
    const active = this.activeFilterKeys();
    return this.customers().filter((c) =>
      active.has(c.userId != null ? `v:${c.userId}` : 'orphans'),
    );
  });

  protected visibleVendorStarts = computed(() => {
    const active = this.activeFilterKeys();
    return this.vendorStarts().filter((v) => active.has(`v:${v.userId}`));
  });

  constructor() {
    effect(() => {
      const idsRaw = this.userIds();
      const orphansRaw = this.orphansOnly();
      untracked(() => {
        const ids = parseIds(idsRaw);
        const orphansOnly = orphansRaw === 'true';
        if (ids.length > 0 || orphansOnly) {
          this.orphansOnlyToggle.set(orphansOnly);
          this.executeQuery(ids, orphansOnly);
        }
      });
    });
  }

  protected colorFor(userId: number): string {
    const idx = this.loadedUserIds().indexOf(userId);
    return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
  }

  protected vendorNameFor(userId: number): string {
    return (
      this.vendorStarts().find((v) => v.userId === userId)?.userName ??
      this.customers().find((c) => c.userId === userId)?.userName ??
      `Vendedor #${userId}`
    );
  }

  protected addVendor(item: UiLookupItem) {
    if (this.pickedVendors().some((v) => v.id === item.id)) return;
    this.pickedVendors.update((list) => [...list, item]);
  }

  protected removeVendor(id: number) {
    this.pickedVendors.update((list) => list.filter((v) => v.id !== id));
  }

  protected applyPicker() {
    const ids = this.pickedVendors().map((v) => v.id);
    if (ids.length === 0 && !this.orphansOnlyToggle()) {
      this.pickerError.set('Elige al menos un vendedor o activa "Incluir huérfanos".');
      return;
    }
    this.pickerError.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        userIds: ids.length ? ids.join(',') : null,
        orphansOnly: this.orphansOnlyToggle() ? 'true' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Si los params no cambiaron (mismo filtro re-aplicado), la navegación no
    // dispara el effect — se fuerza la recarga explícitamente.
    this.executeQuery(ids, this.orphansOnlyToggle());
  }

  protected reload() {
    this.executeQuery(this.loadedUserIds(), this.loadedOrphansOnly());
  }

  protected showAll() {
    this.activeFilterKeys.set(new Set(this.chipKeys().map((c) => c.key)));
  }

  protected toggleChip(key: string) {
    const next = new Set(this.activeFilterKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.activeFilterKeys.set(next);
  }

  private executeQuery(userIds: number[], orphansOnly: boolean) {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc.map({ userIds, orphansOnly }).subscribe({
      next: ({ customers, vendorStarts }) => {
        this.customers.set(customers);
        this.vendorStarts.set(vendorStarts);
        this.loadedUserIds.set(userIds);
        this.loadedOrphansOnly.set(orphansOnly);
        this.pickedVendors.set(
          userIds.map((id) => ({
            id,
            name: vendorStarts.find((v) => v.userId === id)?.userName ?? `Vendedor #${id}`,
          })),
        );
        this.loading.set(false);
        const wasQueried = this.queried();
        this.queried.set(true);
        this.activeFilterKeys.set(
          new Set([...userIds.map((id) => `v:${id}`), ...(orphansOnly ? ['orphans'] : [])]),
        );
        if (!wasQueried) {
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
    this.leafletMap = L.map(el).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.leafletMap);
    this.markersLayer = L.layerGroup().addTo(this.leafletMap);
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private popupHtml(c: MapCustomerView): string {
    const vendor = c.userName ? escapeHtml(c.userName) : 'Sin vendedor (huérfano)';
    return `
      <strong>${escapeHtml(c.customerName)}</strong><br>
      ${escapeHtml(c.code)}<br>
      Vendedor: ${vendor}<br>
      ${c.scheduledToday ? 'Le toca hoy' : 'No le toca hoy'} · ${escapeHtml(visitStatusLabel(c.visitStatusCode))}
      <br><button type="button" class="map-popup-view-btn" data-customer-id="${c.customerId}">Ver ficha</button>
    `;
  }

  /** El botón "Ver ficha" del popup es HTML plano de Leaflet: se conecta el navigate al abrir. */
  private bindPopupViewButton(marker: L.Layer, customerId: number) {
    marker.on('popupopen', (ev) => {
      const el = (ev as L.PopupEvent).popup.getElement();
      el?.querySelector('.map-popup-view-btn')?.addEventListener('click', () => {
        this.router.navigate(['/clientes', customerId]);
      });
    });
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    if (this.routeLayer) {
      this.leafletMap.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    const rows = this.visibleCustomers();
    const bounds: L.LatLngExpression[] = [];

    for (const c of rows) {
      const strokeColor = c.userId != null ? this.colorFor(c.userId) : ORPHAN_COLOR;
      const fillColor = resolveCssVar(visitStatusColorVar(c.visitStatusCode));
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: 7,
        color: strokeColor,
        weight: c.scheduledToday ? 2.5 : c.userId == null ? 2 : 1,
        dashArray: c.userId == null ? '4,3' : undefined,
        fillColor,
        fillOpacity: c.visitStatusCode == null ? 0.4 : 0.9,
      }).bindPopup(this.popupHtml(c));
      this.bindPopupViewButton(marker, c.customerId);
      marker.addTo(this.markersLayer!);
      bounds.push([c.latitude, c.longitude]);
    }

    const soloVendorId = this.soloVendorId();
    if (soloVendorId != null) {
      const start = this.visibleVendorStarts().find((v) => v.userId === soloVendorId);
      const color = this.colorFor(soloVendorId);
      const routePoints = rows.filter((c) => c.userId === soloVendorId && c.scheduledToday);
      const latlngs: [number, number][] = [];
      if (start?.startLatitude != null && start?.startLongitude != null) {
        latlngs.push([start.startLatitude, start.startLongitude]);
        bounds.push([start.startLatitude, start.startLongitude]);
      }
      // Orden asumido = orden de respuesta del backend para los puntos de hoy
      // (no hay campo de secuencia de ruta documentado en MapCustomerView).
      for (const c of routePoints) latlngs.push([c.latitude, c.longitude]);
      if (latlngs.length > 1) {
        this.routeLayer = L.polyline(latlngs, {
          color,
          weight: 3,
          opacity: 0.55,
          dashArray: '6,6',
        }).addTo(this.leafletMap);
      }
    }

    for (const v of this.visibleVendorStarts()) {
      if (v.startLatitude == null || v.startLongitude == null) continue;
      const marker = L.marker([v.startLatitude, v.startLongitude], {
        icon: vendorStartIcon(this.colorFor(v.userId)),
      }).bindPopup(`<strong>${escapeHtml(v.userName)}</strong><br>Inicio de ruta hoy`);
      marker.addTo(this.markersLayer!);
      bounds.push([v.startLatitude, v.startLongitude]);
    }

    if (bounds.length > 0) {
      this.leafletMap.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [24, 24],
        maxZoom: 15,
      });
    }
  }

  protected openCoverage() {
    const absentUserId = this.soloVendorId();
    if (absentUserId == null) return;
    this.dialog.open(CoverageDialog, {
      data: {
        absentUserId,
        absentUserName: this.vendorNameFor(absentUserId),
        customers: this.customers(),
      },
      width: '520px',
    });
  }
}
