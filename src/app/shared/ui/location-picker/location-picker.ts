import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
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
    `,
  ],
})
export class LocationPicker {
  latitude = model<number | null>(null);
  longitude = model<number | null>(null);
  address = model('');

  protected latText = computed(() => (this.latitude() != null ? String(this.latitude()) : ''));
  protected lngText = computed(() => (this.longitude() != null ? String(this.longitude()) : ''));
  protected suggestedAddress = signal('');

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
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  /** Formas 1-3 (buscar, clic, arrastrar) — doc 74, sección 2.4: mueve, centra si corresponde y geocodifica. */
  private applyPoint(lat: number, lng: number, pan: boolean) {
    const rLat = round8(lat);
    const rLng = round8(lng);
    this.latitude.set(rLat);
    this.longitude.set(rLng);
    this.marker?.setLatLng([rLat, rLng]);
    if (pan && this.map) this.map.setView([rLat, rLng], PICKED_ZOOM);
    this.reverseGeocode(rLat, rLng);
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
    this.marker?.setLatLng([lat, lng]);
    if (this.map) this.map.setView([lat, lng], Math.max(this.map.getZoom(), 15));
    this.coordsTyped$.next();
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
