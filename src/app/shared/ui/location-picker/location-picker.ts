import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { Observable, Subject, from } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { UiField } from '../field/field';
import { UiTypeahead, UiLookupItem } from '../typeahead/typeahead';

/** Arequipa, Perú — mismo centro por defecto que el mapa de Asignaciones. */
const DEFAULT_CENTER: [number, number] = [-16.409, -71.537];
const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 17;
const PERU_LAT_RANGE: [number, number] = [-18.5, 0];
const PERU_LNG_RANGE: [number, number] = [-81.5, -68.5];
const COORD_PASTE_RE = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'lp-pin-wrap',
    html: `<span class="lp-pin"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function referencePinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'lp-pin-wrap',
    html: `<span class="lp-pin lp-pin-reference"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Leaflet pinta los vectores (líneas) como atributos SVG: `var()` no se
 * interpreta ahí, hay que resolver el token a su color real — mismo motivo
 * que `visitStatusColorVar` en el mapa de Asignaciones. */
function resolveCssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/**
 * "Selector de ubicación" — doc 74, sección 2.4. Buscador + mapa + marcador
 * arrastrable + "pegar coordenadas" + dirección inversa. Entrada/salida:
 * `{ latitude, longitude, address }`. Leaflet (ya instalado y en uso en el
 * panel; no hay clave de Google Maps configurada) + Nominatim (OSM) para
 * geocodificar, llamado con `fetch` nativo — no con `HttpClient` — para no
 * arrastrar el interceptor que agrega el Bearer del panel a cada petición,
 * que no debe llegar a un dominio de terceros.
 */
@Component({
  selector: 'app-location-picker',
  imports: [UiField, UiTypeahead],
  template: `
    <div class="lp">
      <ui-typeahead
        label="Buscar ubicación"
        placeholder="Busca una dirección, negocio o referencia…"
        icon="search"
        [clearOnPick]="true"
        [search]="addressSearch"
        (picked)="onSearchPicked($event)"
      />

      <div class="lp-map" #mapEl></div>

      @if (outOfPeru()) {
        <div class="lp-warn">⚠ El punto está fuera de Perú: revisa las coordenadas</div>
      }

      @if (hasReference() && movedFromReference()) {
        <div class="lp-moved-row">
          <span class="lp-moved-text">{{ distanceText() }}</span>
          <button type="button" class="lp-reset-link" (click)="resetToReference()">
            ↺ Restablecer
          </button>
        </div>
      }

      @if (addressReadonly()) {
        <div class="lp-field">
          <label>Dirección</label>
          <div class="lp-readonly">{{ address() || '—' }}</div>
          <div class="lp-hint">La dirección no se edita aquí</div>
        </div>
      } @else {
        <ui-field
          label="Dirección"
          [value]="address()"
          (valueChange)="address.set($event)"
          placeholder="Av. Los Incas 123, Cerro Colorado"
        />
        @if (suggestedAddress() && address().trim()) {
          <button type="button" class="lp-use-link" (click)="useSuggested()">
            Usar «{{ suggestedAddress() }}»
          </button>
        }
      }

      <div class="lp-coords-row">
        <ui-field
          label="Latitud"
          type="number"
          [value]="latText()"
          (valueChange)="onLatText($event)"
        />
        <ui-field
          label="Longitud"
          type="number"
          [value]="lngText()"
          (valueChange)="onLngText($event)"
        />
      </div>

      @if (!pasteOpen()) {
        <button type="button" class="lp-paste-link" (click)="togglePaste()">
          Pegar coordenadas
        </button>
      } @else {
        <div class="lp-paste-row">
          <input
            #pasteInput
            type="text"
            class="lp-paste-input"
            placeholder="-16.375482, -71.556923"
            [value]="pasteText()"
            (input)="pasteText.set($any($event.target).value)"
            (keydown.enter)="applyPaste()"
          />
          <button type="button" class="lp-paste-apply" (click)="applyPaste()">Usar</button>
          <button type="button" class="lp-paste-cancel" (click)="togglePaste()">Cancelar</button>
        </div>
        @if (pasteError()) {
          <div class="lp-paste-error">{{ pasteError() }}</div>
        }
      }
    </div>
  `,
  styles: [
    `
      .lp {
        display: grid;
        gap: 14px;
      }
      .lp-map {
        height: 420px;
        border: 1px solid var(--divider);
        background: var(--faint);
      }
      .lp-warn {
        padding: 10px 14px;
        border: 1px solid var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        font-size: 13px;
        color: var(--ink);
      }
      .lp-use-link,
      .lp-paste-link,
      .lp-paste-apply,
      .lp-paste-cancel {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-ink);
        justify-self: start;
      }
      .lp-use-link:hover,
      .lp-paste-link:hover,
      .lp-paste-apply:hover,
      .lp-paste-cancel:hover {
        text-decoration: underline;
      }
      .lp-moved-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .lp-moved-text {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lp-reset-link {
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .lp-reset-link:hover {
        color: var(--ink);
        text-decoration: underline;
      }
      .lp-field {
        display: grid;
        gap: 6px;
      }
      .lp-field label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .lp-readonly {
        min-height: var(--touch-min);
        padding: 0 12px;
        display: flex;
        align-items: center;
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        color: var(--ink-muted);
        font-size: 15px;
      }
      .lp-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lp-coords-row {
        display: flex;
        gap: 12px;
      }
      .lp-coords-row > * {
        flex: 1;
        min-width: 0;
      }
      .lp-paste-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lp-paste-input {
        flex: 1;
        min-width: 0;
        font-family: var(--font-sans);
        font-size: 14px;
        color: var(--ink);
        background: var(--surface-sunk);
        border: 1px solid var(--divider);
        min-height: var(--touch-min);
        padding: 0 12px;
        box-sizing: border-box;
      }
      .lp-paste-cancel {
        color: var(--ink-muted);
      }
      .lp-paste-error {
        font-size: 12px;
        color: var(--status-danger);
      }

      /* Pin del marcador arrastrable — DivIcon, no el ícono por defecto de
         Leaflet. Leaflet inserta este HTML fuera de la plantilla de Angular
         (no pasa por la compilación del componente), así que sus reglas
         necesitan \`::ng-deep\` para no quedar con el atributo de alcance
         que nunca van a tener. */
      ::ng-deep .lp-pin-wrap {
        background: none;
        border: none;
      }
      ::ng-deep .lp-pin {
        display: block;
        width: 22px;
        height: 22px;
        border-radius: 50% 50% 50% 0;
        background: var(--accent);
        border: 2px solid var(--bg);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        transform: rotate(-45deg);
      }
      /** Marcador de referencia ("Ubicación actual") — doc 83, sección 1.2:
          fijo, gris, redondo (no el pin rojo) para distinguirlo a simple vista. */
      ::ng-deep .lp-pin-reference {
        border-radius: 50%;
        background: var(--ink-muted);
        border: 2px solid var(--bg);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        transform: none;
      }
    `,
  ],
})
export class LocationPicker {
  latitude = model<number | null>(null);
  longitude = model<number | null>(null);
  address = model('');

  /** Ubicación de referencia (marcador gris, fijo) — doc 83, sección 1.2: la ubicación actual del cliente en "Editar datos". */
  referenceLatitude = input<number | null>(null);
  referenceLongitude = input<number | null>(null);
  /** La dirección se ve como texto y el buscador solo mueve el punto, sin tocarla — doc 83, sección 1.2. */
  addressReadonly = input(false);

  protected latText = computed(() => (this.latitude() != null ? String(this.latitude()) : ''));
  protected lngText = computed(() => (this.longitude() != null ? String(this.longitude()) : ''));
  protected suggestedAddress = signal('');

  protected hasReference = computed(
    () => this.referenceLatitude() != null && this.referenceLongitude() != null,
  );
  protected movedFromReference = computed(() => {
    const refLat = this.referenceLatitude();
    const refLng = this.referenceLongitude();
    const lat = this.latitude();
    const lng = this.longitude();
    if (refLat == null || refLng == null || lat == null || lng == null) return false;
    return round8(lat) !== round8(refLat) || round8(lng) !== round8(refLng);
  });
  protected distanceText = computed(() => {
    if (!this.movedFromReference()) return '';
    const meters = haversineMeters(
      this.referenceLatitude()!,
      this.referenceLongitude()!,
      this.latitude()!,
      this.longitude()!,
    );
    if (meters >= 1000) {
      return `Se movió ${(meters / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} km`;
    }
    return `Se movió ${Math.round(meters)} m`;
  });

  protected outOfPeru = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat == null || lng == null) return false;
    return (
      lat < PERU_LAT_RANGE[0] ||
      lat > PERU_LAT_RANGE[1] ||
      lng < PERU_LNG_RANGE[0] ||
      lng > PERU_LNG_RANGE[1]
    );
  });

  protected pasteOpen = signal(false);
  protected pasteText = signal('');
  protected pasteError = signal('');

  protected addressSearch = (q: string): Observable<UiLookupItem[]> =>
    from(this.nominatimSearch(q));

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private injector = inject(Injector);
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private referenceMarker: L.Marker | null = null;
  private referenceLine: L.Polyline | null = null;
  private lastNominatimCallAt = 0;
  private searchRawResults: NominatimResult[] = [];
  private coordsTyped$ = new Subject<void>();

  constructor() {
    afterNextRender(() => this.initMap(), { injector: this.injector });
    inject(DestroyRef).onDestroy(() => this.map?.remove());

    this.coordsTyped$.pipe(debounceTime(600), takeUntilDestroyed()).subscribe(() => {
      const lat = this.latitude();
      const lng = this.longitude();
      if (lat != null && lng != null) this.reverseGeocode(lat, lng);
    });
  }

  private initMap() {
    const el = this.mapEl()?.nativeElement;
    if (!el) return;
    const hasPoint = this.latitude() != null && this.longitude() != null;
    const initial: [number, number] = hasPoint
      ? [this.latitude()!, this.longitude()!]
      : DEFAULT_CENTER;
    this.map = L.map(el, { preferCanvas: true }).setView(
      initial,
      hasPoint ? PICKED_ZOOM : DEFAULT_ZOOM,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    this.marker = L.marker(initial, { draggable: true, icon: pinIcon() }).addTo(this.map);
    this.marker.on('dragend', () => {
      const pos = this.marker!.getLatLng();
      this.applyPoint(pos.lat, pos.lng, false);
    });
    this.map.on('click', (ev: L.LeafletMouseEvent) => {
      this.applyPoint(ev.latlng.lat, ev.latlng.lng, false);
    });

    const refLat = this.referenceLatitude();
    const refLng = this.referenceLongitude();
    if (refLat != null && refLng != null) {
      this.referenceMarker = L.marker([refLat, refLng], {
        draggable: false,
        icon: referencePinIcon(),
        interactive: false,
      })
        .bindTooltip('Ubicación actual')
        .addTo(this.map);
      this.updateReferenceLine(initial[0], initial[1]);
    }
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  /** Sin geocodificar — para el marcador y la línea de referencia; `applyPoint` también geocodifica. */
  private moveMarkerAndLine(lat: number, lng: number, pan: boolean) {
    this.marker?.setLatLng([lat, lng]);
    if (pan && this.map) this.map.setView([lat, lng], PICKED_ZOOM);
    this.updateReferenceLine(lat, lng);
  }

  private updateReferenceLine(lat: number, lng: number) {
    if (!this.hasReference() || !this.map) return;
    const refLat = this.referenceLatitude()!;
    const refLng = this.referenceLongitude()!;
    const moved = round8(lat) !== round8(refLat) || round8(lng) !== round8(refLng);
    if (!moved) {
      this.referenceLine?.remove();
      this.referenceLine = null;
      return;
    }
    const latlngs: [number, number][] = [
      [refLat, refLng],
      [lat, lng],
    ];
    if (this.referenceLine) {
      this.referenceLine.setLatLngs(latlngs);
    } else {
      this.referenceLine = L.polyline(latlngs, {
        color: resolveCssVar('--ink-muted', '#888888'),
        weight: 2,
        dashArray: '4 6',
        interactive: false,
      }).addTo(this.map);
    }
  }

  /** "↺ Restablecer" — doc 83, sección 1.2: vuelve el pin rojo a la ubicación actual, sin geocodificar de nuevo. */
  protected resetToReference() {
    const lat = this.referenceLatitude();
    const lng = this.referenceLongitude();
    if (lat == null || lng == null) return;
    this.latitude.set(lat);
    this.longitude.set(lng);
    this.moveMarkerAndLine(lat, lng, true);
  }

  /** Formas 1-3 (buscar, clic, arrastrar) — doc 74, sección 2.4: mueve, centra si corresponde y geocodifica. */
  private applyPoint(lat: number, lng: number, pan: boolean) {
    const rLat = round8(lat);
    const rLng = round8(lng);
    this.latitude.set(rLat);
    this.longitude.set(rLng);
    this.moveMarkerAndLine(rLat, rLng, pan);
    if (!this.addressReadonly()) this.reverseGeocode(rLat, rLng);
  }

  protected onSearchPicked(item: UiLookupItem) {
    const raw = this.searchRawResults[item.id];
    if (!raw) return;
    this.applyPoint(Number(raw.lat), Number(raw.lon), true);
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const wait = Math.max(0, 1000 - (Date.now() - this.lastNominatimCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastNominatimCallAt = Date.now();
    return fetch(url);
  }

  private async nominatimSearch(q: string): Promise<UiLookupItem[]> {
    const needle = q.trim();
    if (!needle) {
      this.searchRawResults = [];
      return [];
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=pe&limit=6&q=${encodeURIComponent(needle)}`;
    const res = await this.rateLimitedFetch(url);
    if (!res.ok) throw new Error('nominatim search failed');
    const results = (await res.json()) as NominatimResult[];
    this.searchRawResults = results;
    return results.map((r, i) => ({ id: i, name: r.display_name }));
  }

  private reverseGeocode(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    this.rateLimitedFetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { display_name?: string } | null) => {
        const name = data?.display_name;
        if (!name) return;
        if (!this.address().trim()) {
          this.address.set(name);
          this.suggestedAddress.set('');
        } else {
          this.suggestedAddress.set(name);
        }
      })
      .catch(() => undefined);
  }

  protected useSuggested() {
    this.address.set(this.suggestedAddress());
    this.suggestedAddress.set('');
  }

  /** Forma 4 (escribir/pegar lat-lng) — doc 74, sección 2.4: se mueve cuando ambos valores son válidos. */
  protected onLatText(v: string) {
    this.latitude.set(v.trim() === '' ? null : Number(v));
    this.syncMarkerFromText();
  }
  protected onLngText(v: string) {
    this.longitude.set(v.trim() === '' ? null : Number(v));
    this.syncMarkerFromText();
  }
  private syncMarkerFromText() {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const zoom = this.map ? Math.max(this.map.getZoom(), 15) : PICKED_ZOOM;
    this.marker?.setLatLng([lat, lng]);
    if (this.map) this.map.setView([lat, lng], zoom);
    this.updateReferenceLine(lat, lng);
    if (!this.addressReadonly()) this.coordsTyped$.next();
  }

  protected togglePaste() {
    this.pasteOpen.update((v) => !v);
    this.pasteText.set('');
    this.pasteError.set('');
  }

  protected applyPaste() {
    const match = this.pasteText().match(COORD_PASTE_RE);
    if (!match) {
      this.pasteError.set('No reconocemos ese formato. Ejemplo: -16.375482, -71.556923');
      return;
    }
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.pasteError.set('Las coordenadas están fuera de rango.');
      return;
    }
    this.applyPoint(lat, lng, true);
    this.pasteOpen.set(false);
    this.pasteText.set('');
    this.pasteError.set('');
  }
}
