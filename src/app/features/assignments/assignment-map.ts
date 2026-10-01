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
import 'leaflet.markercluster';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiToggle } from '../../shared/ui/toggle/toggle';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../promos/lookup';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CoverageDialog } from './ui/coverage-dialog';
import { CreateAssignmentDialog } from './ui/create-assignment-dialog';
import { AssignmentAdminService } from './assignment-admin';
import {
  MapCustomerView,
  MapRouteView,
  MapVisitView,
} from '../../shared/models/assignment-admin.models';
import { durationText, timeText, visitStatusColorVar } from './assignment-format';
import { formatSoles } from '../../shared/pipes/money';

// Paleta categórica fija para identificar vendedores (borde de sus clientes,
// pin de inicio/fin de ruta y pestaña de bitácora) — no depende del tema
// claro/oscuro: son colores de datos, no de superficie. Se recicla por
// módulo si hay más vendedores que colores.
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
const ORPHAN_FILL = '#9a958f';
const MAX_VENDORS = 10;
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

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Leaflet pinta sus paths/iconos como HTML o atributos SVG, no CSS: `var()`
 * no se resuelve ahí. Se lee el valor calculado del token en el tema actual. */
function resolveCssVar(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || '#888888';
}

/** Pin de inicio de ruta (bandera verde) / fin de ruta (bandera a cuadros). */
function routeFlagIcon(kind: 'start' | 'end', color: string): L.DivIcon {
  const flagColor = kind === 'start' ? '#1a8f4c' : '#201e1d';
  const pattern =
    kind === 'end'
      ? `<rect x="4" y="2" width="4" height="4" fill="#fff"/><rect x="12" y="2" width="4" height="4" fill="#fff"/><rect x="8" y="6" width="4" height="4" fill="#fff"/><rect x="16" y="6" width="4" height="4" fill="#fff"/>`
      : '';
  return L.divIcon({
    className: 'map-route-flag-icon',
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#1a1918" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="8" fill="${flagColor}"/>
      <svg x="5" y="5" width="20" height="16" viewBox="0 0 20 10">${pattern}</svg>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  });
}

interface PointStyle {
  size: number;
  fill: string;
  innerBorder: string;
  dashedInner: boolean;
  outerRing: string | null; // color del dueño cuando hay cobertura
  opacity: number;
}

/** Ícono de cada cliente — div con un punto de color, construido con CSS
 * inline (sin assets) para poder agruparlo con Leaflet.markercluster, que
 * solo agrupa L.Marker con ícono, no vectores (L.circleMarker). */
function customerPointIcon(s: PointStyle, hasOrder: boolean): L.DivIcon {
  const total = s.outerRing ? s.size + 10 : s.size;
  const bag = hasOrder
    ? `<span style="position:absolute;right:-3px;bottom:-3px;width:11px;height:11px;background:#fff;border-radius:2px;border:1px solid ${s.innerBorder};display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;">🛍</span>`
    : '';
  const outer = s.outerRing
    ? `border:2px dashed ${s.outerRing};border-radius:50%;width:${total}px;height:${total}px;display:flex;align-items:center;justify-content:center;`
    : `width:${total}px;height:${total}px;`;
  return L.divIcon({
    className: 'map-point-icon',
    html: `<div style="${outer}position:relative;">
      <span style="display:block;width:${s.size}px;height:${s.size}px;border-radius:50%;
        background:${s.fill};opacity:${s.opacity};
        border:2px ${s.dashedInner ? 'dashed' : 'solid'} ${s.innerBorder};"></span>
      ${bag}
    </div>`,
    iconSize: [total, total],
    iconAnchor: [total / 2, total / 2],
    popupAnchor: [0, -total / 2],
  });
}

/**
 * Mapa de cartera por fecha (GET /api/admin/assignments/map?date=). El
 * endpoint nunca se llama sin filtro: hace falta elegir vendedores y/o
 * huérfanos antes de pintar nada. Debajo va la bitácora del recorrido,
 * armada en el navegador con `visits` y `routes` de la misma respuesta
 * (sección 11 del doc: no hay endpoint propio).
 */
@Component({
  selector: 'app-assignment-map',
  imports: [UiButton, UiField, UiToggle, UiTypeahead, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="map-page">
      <div class="map-head">
        <h1>Mapa de cartera</h1>
        <p class="map-sub">
          Elige uno o varios vendedores, o huérfanos. Con un único vendedor se traza su ruta
          planificada.
        </p>
      </div>

      <div class="map-picker">
        <div class="map-picker-row">
          <ui-typeahead
            label="Agregar vendedor"
            placeholder="Busca por nombre"
            [clearOnPick]="true"
            [disabled]="pickedVendors().length >= maxVendors"
            [search]="userSearch"
            (picked)="addVendor($event)"
          />
          <ui-field label="Fecha" type="date" [(value)]="selectedDate" />
          <div class="map-date-quick">
            <button uiButton variant="ghost" size="sm" (click)="setDate(-1)">Ayer</button>
            <button uiButton variant="ghost" size="sm" (click)="setDate(0)">Hoy</button>
            <button uiButton variant="ghost" size="sm" (click)="setDate(1)">Mañana</button>
          </div>
          <ui-toggle label="Incluir huérfanos" [(checked)]="orphansOnlyToggle" />
          <button uiButton variant="primary" (click)="applyPicker()">
            {{ queried() ? 'Actualizar mapa' : 'Ver mapa' }}
          </button>
        </div>

        <p class="map-date-label">{{ dateLabel() }}</p>

        @if (pickedVendors().length >= maxVendors) {
          <p class="map-picker-limit">Máximo {{ maxVendors }} vendedores en el mapa</p>
        }

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

          @if (soloVendorId() !== null && !isPastDate()) {
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
          <span class="map-legend-title">Relleno = estado de visita:</span>
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-pending"></span>Pendiente de visitar</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-attended"></span>Atendido</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-no-purchase"></span>No compró</span
          >
          <span class="map-legend-item"
            ><span class="map-legend-dot map-legend-closed"></span>Cerrado</span
          >
          <span class="map-legend-note">Borde = vendedor que visita ese día</span>
        </div>

        @if (loadedUserIds().length > 1) {
          <p class="map-route-hint">Para trazar la ruta planificada, consulta un solo vendedor.</p>
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

        @if (!loading() && !error() && withoutLocation().length > 0) {
          <details class="map-no-location">
            <summary>{{ withoutLocation().length }} clientes sin ubicación</summary>
            <ul>
              @for (c of withoutLocation(); track c.customerId) {
                <li>{{ c.customerName }} · {{ c.code }}</li>
              }
            </ul>
          </details>
        }

        @if (!loading() && !error() && bitacoraVendors().length > 0) {
          <div class="map-log">
            <h2 class="map-log-title">Bitácora del recorrido</h2>
            <div class="map-log-tabs">
              @for (v of bitacoraVendors(); track v.userId) {
                <button
                  type="button"
                  class="map-log-tab"
                  [class.on]="activeLogTab() === v.userId"
                  [style.--chip-color]="colorFor(v.userId)"
                  (click)="activeLogTab.set(v.userId)"
                >
                  {{ v.userName }}
                </button>
              }
            </div>

            @if (activeLogSummary(); as s) {
              <p class="map-log-summary">
                {{ s.vendorName }} · {{ s.visitCount }} visita{{ s.visitCount === 1 ? '' : 's' }} ·
                {{ s.orderCount }} pedido{{ s.orderCount === 1 ? '' : 's' }} ·
                {{ formatSoles(s.totalAmount) }}
              </p>
            }

            <div class="map-log-lines">
              @for (line of activeLogLines(); track $index) {
                @if (line.kind === 'start') {
                  <div class="map-log-line map-log-flag">⚑ Inicio de ruta · {{ line.time }}</div>
                } @else if (line.kind === 'end') {
                  <div class="map-log-line map-log-flag">⚑ {{ line.label }}</div>
                } @else {
                  <button
                    type="button"
                    class="map-log-line map-log-visit"
                    (click)="focusVisit(line.visit!)"
                  >
                    <span class="map-log-time">{{ line.time }}</span>
                    <span class="map-log-client">{{ line.visit!.customerName }}</span>
                    <span
                      class="map-log-result"
                      [class.map-log-cancelled]="line.visit!.orderStatusCode === 'CANCELLED'"
                    >
                      <span
                        class="map-log-dot"
                        [style.background]="resolveStatusColor(line.visit!.visitStatusCode)"
                      ></span>
                      @if (line.visit!.orderId) {
                        Pedido {{ formatSoles(line.visit!.orderNetAmount) }}
                      } @else {
                        {{ line.visit!.visitStatusName
                        }}{{
                          line.visit!.visitReasonName ? ' · ' + line.visit!.visitReasonName : ''
                        }}
                      }
                      @if (line.repeat) {
                        <span class="map-log-repeat">↺ {{ line.repeat }}.ª visita</span>
                      }
                    </span>
                    <span class="map-log-duration">{{ line.duration }}</span>
                  </button>
                }
              }
            </div>
          </div>
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
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: end;
      }
      .map-picker-row ui-typeahead {
        flex: 1;
        min-width: 220px;
      }
      .map-picker-row ui-field {
        width: 170px;
      }
      .map-date-quick {
        display: flex;
        gap: 4px;
      }
      .map-date-label {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
        font-style: italic;
      }
      .map-picker-limit {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--accent-ink);
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
      .map-legend-title {
        font-weight: 600;
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
      .map-legend-pending {
        background: var(--st-pending);
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
        height: 60vh;
        min-height: 480px;
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
      .map-no-location {
        margin-top: 14px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .map-no-location summary {
        cursor: pointer;
        color: var(--ink);
      }
      .map-no-location ul {
        margin: 8px 0 0;
        padding-left: 18px;
      }

      .map-log {
        margin-top: 28px;
        border-top: var(--border-rule);
        padding-top: 18px;
      }
      .map-log-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 12px;
        color: var(--ink);
      }
      .map-log-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        border-bottom: var(--border-rule);
      }
      .map-log-tab {
        appearance: none;
        background: none;
        border: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 13px;
        padding: 10px 16px;
        color: var(--ink-muted);
        border-bottom: 3px solid transparent;
      }
      .map-log-tab.on {
        color: var(--ink);
        border-bottom-color: var(--chip-color, var(--accent));
      }
      .map-log-summary {
        margin: 12px 0 0;
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
      }
      .map-log-lines {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        margin-top: 10px;
        max-height: 420px;
        overflow-y: auto;
      }
      .map-log-line {
        background: var(--bg);
      }
      .map-log-flag {
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 800;
        color: var(--ink-muted);
      }
      .map-log-visit {
        appearance: none;
        border: 0;
        width: 100%;
        text-align: left;
        cursor: pointer;
        display: grid;
        grid-template-columns: 52px 1fr auto 90px;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        font-family: var(--font-sans);
        font-size: 13px;
        color: var(--ink);
      }
      .map-log-visit:hover {
        background: var(--faint);
      }
      .map-log-time {
        font-variant-numeric: var(--tnum);
        color: var(--ink-muted);
      }
      .map-log-result {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .map-log-cancelled {
        text-decoration: line-through;
        color: var(--ink-muted);
      }
      .map-log-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .map-log-repeat {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .map-log-duration {
        text-align: right;
        font-size: 12px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 900px) {
        .map-picker-row {
          flex-direction: column;
          align-items: stretch;
        }
        .map-picker-row ui-field {
          width: 100%;
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
        .map-log-visit {
          grid-template-columns: 44px 1fr;
          grid-template-rows: auto auto;
        }
        .map-log-duration {
          text-align: left;
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
  // los enlaces desde Ausencias/Coberturas ("Ver en mapa") disparan la carga.
  userIds = input('', { alias: 'userIds' });
  orphansOnly = input('', { alias: 'orphansOnly' });
  dateParam = input('', { alias: 'date' });

  protected maxVendors = MAX_VENDORS;
  protected formatSoles = formatSoles;

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected pickedVendors = signal<UiLookupItem[]>([]);
  protected orphansOnlyToggle = signal(false);
  protected selectedDate = signal(todayIso());
  protected pickerError = signal('');

  protected queried = signal(false);
  protected loading = signal(false);
  protected error = signal(false);
  protected customers = signal<MapCustomerView[]>([]);
  protected visits = signal<MapVisitView[]>([]);
  protected routes = signal<MapRouteView[]>([]);
  protected loadedDate = signal(todayIso());
  protected loadedUserIds = signal<number[]>([]);
  protected loadedOrphansOnly = signal(false);
  protected activeFilterKeys = signal<Set<string>>(new Set());
  protected activeLogTab = signal<number | null>(null);

  private mapEl = viewChild<ElementRef<HTMLDivElement>>('mapEl');
  private leafletMap: L.Map | null = null;
  private markersLayer: L.MarkerClusterGroup | null = null;
  private plannedRouteLayer: L.Polyline | null = null;
  private realRouteLayer: L.Polyline | null = null;
  private markerByCustomerId = new Map<number, L.Marker>();

  protected vendorNames = computed(() => {
    const names = new Map<number, string>();
    for (const c of this.customers()) {
      if (c.ownerUserId != null && c.ownerUserName) names.set(c.ownerUserId, c.ownerUserName);
      if (c.coveringUserId != null && c.coveringUserName)
        names.set(c.coveringUserId, c.coveringUserName);
    }
    for (const v of this.visits()) names.set(v.userId, v.userName);
    for (const r of this.routes()) names.set(r.userId, r.userName);
    return names;
  });

  protected chipKeys = computed(() => {
    const chips = this.loadedUserIds().map((id) => ({
      key: `v:${id}`,
      label: this.vendorNameFor(id),
      color: this.colorFor(id),
      dashed: false,
    }));
    if (this.loadedOrphansOnly() || this.customers().some((c) => c.visitingUserId == null)) {
      chips.push({ key: 'orphans', label: 'Huérfanos', color: ORPHAN_COLOR, dashed: true });
    }
    return chips;
  });

  protected isAllActive = computed(() => this.activeFilterKeys().size === this.chipKeys().length);

  protected soloVendorId = computed(() =>
    this.loadedUserIds().length === 1 && !this.loadedOrphansOnly() ? this.loadedUserIds()[0] : null,
  );

  protected isPastDate = computed(() => this.selectedDate() < todayIso());

  protected dateLabel = computed(() => {
    const date = this.loadedDate() || this.selectedDate();
    const today = todayIso();
    if (date === today) return 'En vivo.';
    if (date < today) return `Viendo lo que pasó el ${date}.`;
    return `Plan del ${date} (todavía sin visitas).`;
  });

  protected visibleCustomers = computed(() => {
    const active = this.activeFilterKeys();
    return this.customers().filter((c) =>
      active.has(c.visitingUserId != null ? `v:${c.visitingUserId}` : 'orphans'),
    );
  });

  protected withoutLocation = computed(() =>
    this.visibleCustomers().filter((c) => c.latitude == null || c.longitude == null),
  );

  /** Vendedores con ruta o visitas esa fecha, en el orden de los chips. */
  protected bitacoraVendors = computed(() => {
    const visitVendors = new Set(this.visits().map((v) => v.userId));
    const routeVendors = new Set(this.routes().map((r) => r.userId));
    return this.loadedUserIds()
      .filter((id) => visitVendors.has(id) || routeVendors.has(id))
      .map((id) => ({ userId: id, userName: this.vendorNameFor(id) }));
  });

  protected activeLogSummary = computed(() => {
    const userId = this.activeLogTab();
    if (userId == null) return null;
    const visits = this.visits().filter((v) => v.userId === userId);
    const orders = visits.filter((v) => v.orderId != null && v.orderStatusCode !== 'CANCELLED');
    const totalAmount = orders.reduce((acc, v) => acc + (v.orderNetAmount ?? 0), 0);
    return {
      vendorName: this.vendorNameFor(userId),
      visitCount: visits.length,
      orderCount: orders.length,
      totalAmount,
    };
  });

  protected activeLogLines = computed(() => {
    const userId = this.activeLogTab();
    if (userId == null) return [];
    const route = this.routes().find((r) => r.userId === userId);
    const visits = [...this.visits()]
      .filter((v) => v.userId === userId)
      .sort((a, b) => a.visitedAt.localeCompare(b.visitedAt));

    type Line =
      | { kind: 'start'; time: string }
      | { kind: 'end'; label: string }
      | { kind: 'visit'; time: string; visit: MapVisitView; duration: string; repeat: number };

    const lines: Line[] = [];
    let prevTime: Date | null = null;
    if (route) {
      lines.push({ kind: 'start', time: timeText(route.startTime) });
      prevTime = new Date(route.startTime);
    }
    const seenCount = new Map<number, number>();
    for (const v of visits) {
      const seen = (seenCount.get(v.customerId) ?? 0) + 1;
      seenCount.set(v.customerId, seen);
      const visitedAt = new Date(v.visitedAt);
      const minutes = prevTime ? (visitedAt.getTime() - prevTime.getTime()) / 60000 : 0;
      lines.push({
        kind: 'visit',
        time: timeText(v.visitedAt),
        visit: v,
        duration: prevTime ? durationText(Math.max(0, minutes)) : '—',
        repeat: seen > 1 ? seen : 0,
      });
      prevTime = visitedAt;
    }
    if (route) {
      lines.push({
        kind: 'end',
        label: route.endTime
          ? `Fin de ruta · ${timeText(route.endTime)}`
          : this.loadedDate() === todayIso()
            ? 'Ruta en curso'
            : 'No terminó la ruta',
      });
    } else {
      lines.push({ kind: 'end', label: 'No inició ruta este día' });
    }
    return lines;
  });

  constructor() {
    effect(() => {
      const idsRaw = this.userIds();
      const orphansRaw = this.orphansOnly();
      const dateRaw = this.dateParam();
      untracked(() => {
        const ids = parseIds(idsRaw);
        const orphansOnly = orphansRaw === 'true';
        if (ids.length > 0 || orphansOnly) {
          this.orphansOnlyToggle.set(orphansOnly);
          if (dateRaw) this.selectedDate.set(dateRaw);
          this.executeQuery(ids, orphansOnly, dateRaw || this.selectedDate());
        }
      });
    });
  }

  protected colorFor(userId: number): string {
    const idx = this.loadedUserIds().indexOf(userId);
    return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
  }

  protected vendorNameFor(userId: number): string {
    return this.vendorNames().get(userId) ?? `Vendedor #${userId}`;
  }

  protected resolveStatusColor(code: string): string {
    return resolveCssVar(visitStatusColorVar(code));
  }

  protected addVendor(item: UiLookupItem) {
    if (this.pickedVendors().some((v) => v.id === item.id)) return;
    if (this.pickedVendors().length >= MAX_VENDORS) return;
    this.pickedVendors.update((list) => [...list, item]);
  }

  protected removeVendor(id: number) {
    this.pickedVendors.update((list) => list.filter((v) => v.id !== id));
  }

  protected setDate(offsetDays: number) {
    this.selectedDate.set(addDays(todayIso(), offsetDays));
  }

  protected applyPicker() {
    const ids = this.pickedVendors().map((v) => v.id);
    if (ids.length === 0 && !this.orphansOnlyToggle()) {
      this.pickerError.set('Elige al menos un vendedor o activa "Incluir huérfanos".');
      return;
    }
    if (ids.length > MAX_VENDORS) {
      this.pickerError.set(`El mapa admite hasta ${MAX_VENDORS} vendedores a la vez.`);
      return;
    }
    this.pickerError.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        userIds: ids.length ? ids.join(',') : null,
        orphansOnly: this.orphansOnlyToggle() ? 'true' : null,
        date: this.selectedDate() !== todayIso() ? this.selectedDate() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Si los params no cambiaron (mismo filtro re-aplicado), la navegación no
    // dispara el effect — se fuerza la recarga explícitamente.
    this.executeQuery(ids, this.orphansOnlyToggle(), this.selectedDate());
  }

  protected reload() {
    this.executeQuery(this.loadedUserIds(), this.loadedOrphansOnly(), this.loadedDate());
  }

  protected showAll() {
    this.activeFilterKeys.set(new Set(this.chipKeys().map((c) => c.key)));
  }

  protected toggleChip(key: string) {
    const next = new Set(this.activeFilterKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.activeFilterKeys.set(next);
  }

  private executeQuery(userIds: number[], orphansOnly: boolean, date: string) {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc.map({ userIds, orphansOnly, date }).subscribe({
      next: (res) => {
        this.customers.set(res.customers);
        this.visits.set(res.visits);
        this.routes.set(res.routes);
        this.loadedDate.set(res.date);
        this.loadedUserIds.set(userIds);
        this.loadedOrphansOnly.set(orphansOnly);
        this.pickedVendors.set(
          userIds.map((id) => ({
            id,
            name:
              res.customers.find((c) => c.ownerUserId === id)?.ownerUserName ??
              res.visits.find((v) => v.userId === id)?.userName ??
              res.routes.find((r) => r.userId === id)?.userName ??
              `Vendedor #${id}`,
          })),
        );
        this.loading.set(false);
        const wasQueried = this.queried();
        this.queried.set(true);
        this.activeFilterKeys.set(
          new Set([...userIds.map((id) => `v:${id}`), ...(orphansOnly ? ['orphans'] : [])]),
        );
        const bitacora = this.bitacoraVendors();
        this.activeLogTab.set(bitacora.length ? bitacora[0].userId : null);
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
    this.markersLayer = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 17,
    });
    this.leafletMap.addLayer(this.markersLayer);
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }

  private popupHtml(c: MapCustomerView): string {
    const isOrphan = c.visitingUserId == null;
    const parts: string[] = [
      `<strong>${escapeHtml(c.customerName)}</strong> · ${escapeHtml(c.code)}`,
    ];
    if (!isOrphan) {
      parts.push(`Cartera de: ${escapeHtml(c.ownerUserName ?? '—')}`);
    }
    if (c.coveringUserId != null) {
      parts.push(`Cubierto hoy por: ${escapeHtml(c.coveringUserName ?? '—')}`);
    }
    if (!c.scheduled) {
      parts.push('No le toca visita este día');
    }
    parts.push('──────');
    parts.push(
      `● ${escapeHtml(c.visitStatusName)}${c.lastVisitAt ? ' · ' + timeText(c.lastVisitAt) : ''}`,
    );
    if (c.orderId != null) {
      parts.push(
        `Pedido ${formatSoles(c.orderNetAmount ?? 0)} · ${escapeHtml(c.orderStatusName ?? '')}`,
      );
    }
    if (c.visitReasonName) {
      parts.push(`Motivo: ${escapeHtml(c.visitReasonName)}`);
    }
    parts.push('──────');
    const secondAction = isOrphan
      ? `<button type="button" class="map-popup-assign-btn" data-customer-id="${c.customerId}">Asignar</button>`
      : `<button type="button" class="map-popup-log-btn" data-vendor-id="${c.visitingUserId}" data-customer-id="${c.customerId}">Ver en bitácora</button>`;
    parts.push(
      `<div class="map-popup-actions"><button type="button" class="map-popup-view-btn" data-customer-id="${c.customerId}">Ver ficha completa</button>${secondAction}</div>`,
    );
    return parts.join('<br>');
  }

  /** Los botones del popup son HTML plano de Leaflet: se conectan al abrir. */
  private bindPopupButtons(marker: L.Layer, c: MapCustomerView) {
    marker.on('popupopen', (ev) => {
      const el = (ev as L.PopupEvent).popup.getElement();
      el?.querySelector('.map-popup-view-btn')?.addEventListener('click', () => {
        this.router.navigate(['/clientes', c.customerId]);
      });
      el?.querySelector('.map-popup-assign-btn')?.addEventListener('click', () => {
        this.dialog
          .open(CreateAssignmentDialog, {
            data: { fixedCustomer: { id: c.customerId, name: c.customerName, code: c.code } },
            width: '520px',
          })
          .afterClosed()
          .subscribe((created) => created && this.reload());
      });
      el?.querySelector('.map-popup-log-btn')?.addEventListener('click', () => {
        if (c.visitingUserId != null) this.activeLogTab.set(c.visitingUserId);
      });
    });
  }

  private pointStyle(c: MapCustomerView): PointStyle {
    const isOrphan = c.visitingUserId == null;
    const size = c.scheduled ? 16 : 11;
    const opacity = c.scheduled ? 0.95 : 0.4;
    if (isOrphan) {
      return {
        size,
        fill: ORPHAN_FILL,
        innerBorder: ORPHAN_COLOR,
        dashedInner: true,
        outerRing: null,
        opacity,
      };
    }
    const fill = resolveCssVar(visitStatusColorVar(c.visitStatusCode));
    const innerBorder = this.colorFor(c.visitingUserId!);
    const outerRing =
      c.coveringUserId != null && c.ownerUserId != null ? this.colorFor(c.ownerUserId) : null;
    return { size, fill, innerBorder, dashedInner: false, outerRing, opacity };
  }

  private redraw() {
    if (!this.leafletMap || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    this.markerByCustomerId.clear();
    if (this.plannedRouteLayer) {
      this.leafletMap.removeLayer(this.plannedRouteLayer);
      this.plannedRouteLayer = null;
    }
    if (this.realRouteLayer) {
      this.leafletMap.removeLayer(this.realRouteLayer);
      this.realRouteLayer = null;
    }

    const rows = this.visibleCustomers().filter((c) => c.latitude != null && c.longitude != null);
    const bounds: L.LatLngExpression[] = [];

    for (const c of rows) {
      const style = this.pointStyle(c);
      const marker = L.marker([c.latitude!, c.longitude!], {
        icon: customerPointIcon(style, c.orderId != null),
      }).bindPopup(this.popupHtml(c));
      this.bindPopupButtons(marker, c);
      this.markersLayer.addLayer(marker);
      this.markerByCustomerId.set(c.customerId, marker);
      bounds.push([c.latitude!, c.longitude!]);
    }

    // Ruta planificada: solo con un único vendedor elegido.
    const soloVendorId = this.soloVendorId();
    if (soloVendorId != null) {
      const planned = rows
        .filter((c) => c.visitingUserId === soloVendorId && c.scheduled)
        .sort((a, b) => (a.routeSequence ?? 0) - (b.routeSequence ?? 0))
        .map((c) => [c.latitude!, c.longitude!] as [number, number]);
      if (planned.length > 1) {
        this.plannedRouteLayer = L.polyline(planned, {
          color: this.colorFor(soloVendorId),
          weight: 3,
          opacity: 0.55,
          dashArray: '6,6',
        }).addTo(this.leafletMap);
      }
    }

    // Recorrido real: del vendedor de la pestaña activa de la bitácora.
    const activeVendorId = this.activeLogTab();
    if (activeVendorId != null) {
      const visitPoints = [...this.visits()]
        .filter((v) => v.userId === activeVendorId && v.latitude != null && v.longitude != null)
        .sort((a, b) => a.visitedAt.localeCompare(b.visitedAt))
        .map((v) => [v.latitude!, v.longitude!] as [number, number]);
      const route = this.routes().find((r) => r.userId === activeVendorId);
      const real: [number, number][] = [];
      if (route?.startLatitude != null && route?.startLongitude != null) {
        real.push([route.startLatitude, route.startLongitude]);
      }
      real.push(...visitPoints);
      if (route?.endLatitude != null && route?.endLongitude != null) {
        real.push([route.endLatitude, route.endLongitude]);
      }
      if (real.length > 1) {
        this.realRouteLayer = L.polyline(real, {
          color: this.colorFor(activeVendorId),
          weight: 4,
          opacity: 0.85,
        }).addTo(this.leafletMap);
      }
    }

    for (const r of this.routes()) {
      if (!this.activeFilterKeys().has(`v:${r.userId}`)) continue;
      if (r.startLatitude != null && r.startLongitude != null) {
        L.marker([r.startLatitude, r.startLongitude], {
          icon: routeFlagIcon('start', this.colorFor(r.userId)),
        })
          .bindPopup(`<strong>${escapeHtml(r.userName)}</strong><br>Inicio de ruta`)
          .addTo(this.leafletMap);
        bounds.push([r.startLatitude, r.startLongitude]);
      }
      if (r.endLatitude != null && r.endLongitude != null) {
        L.marker([r.endLatitude, r.endLongitude], {
          icon: routeFlagIcon('end', this.colorFor(r.userId)),
        })
          .bindPopup(`<strong>${escapeHtml(r.userName)}</strong><br>Fin de ruta`)
          .addTo(this.leafletMap);
        bounds.push([r.endLatitude, r.endLongitude]);
      }
    }

    if (bounds.length > 0) {
      this.leafletMap.fitBounds(bounds as L.LatLngBoundsExpression, {
        padding: [24, 24],
        maxZoom: 15,
      });
    }
  }

  protected focusVisit(visit: MapVisitView) {
    const marker = this.markerByCustomerId.get(visit.customerId);
    if (!this.leafletMap) return;
    const latlng: [number, number] | null =
      visit.latitude != null && visit.longitude != null
        ? [visit.latitude, visit.longitude]
        : marker
          ? [marker.getLatLng().lat, marker.getLatLng().lng]
          : null;
    if (latlng) this.leafletMap.setView(latlng, Math.max(this.leafletMap.getZoom(), 15));
    marker?.openPopup();
  }

  protected openCoverage() {
    const absentUserId = this.soloVendorId();
    if (absentUserId == null) return;
    this.dialog
      .open(CoverageDialog, {
        data: {
          absentUserId,
          absentUserName: this.vendorNameFor(absentUserId),
          defaultDate: this.loadedDate(),
        },
        width: '560px',
      })
      .afterClosed()
      .subscribe((done) => done && this.reload());
  }
}
