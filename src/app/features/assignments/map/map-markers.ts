import * as L from 'leaflet';
import { MapPointStatus } from '../../../shared/models/assignment-map.models';
import { mapStatusColorVar } from '../map-format';

/** Leaflet pinta canvas con colores resueltos: `var()` no se resuelve ahí.
 * Para los DivIcon (HTML real) no hace falta: se usa `var(--token)` directo. */
export function resolveCssVar(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || '#888888';
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function glyphFor(status: MapPointStatus): string {
  switch (status) {
    case 'ORDERED':
      return '✓';
    case 'NO_ORDER':
      return '✕';
    case 'CLOSED':
      return '–';
    default:
      return '';
  }
}

/**
 * Marcador de la vista general (doc 40, sección 3.2): el color dice el
 * vendedor y la forma dice la visita. `vendorColorVar` ya viene resuelto a
 * `var(--map-vendor-NN)` (o su `color-mix` para mapColor > 25) por quien
 * arma el punto — `mapVendorColorVar()` de `map-format.ts`.
 */
export function vendorPointIcon(
  status: MapPointStatus,
  vendorColorVar: string,
  offPlan: boolean,
): L.DivIcon {
  const pending = status === 'PENDING';
  const size = pending ? 12 : 17;
  const total = offPlan ? size + 6 : size;
  const fillStyle = pending
    ? `background:#fff;border:2.5px solid ${vendorColorVar};`
    : `background:${vendorColorVar};border:2px solid ${vendorColorVar};`;
  const shapeRadius = offPlan ? '16%' : '50%';
  const rotate = offPlan
    ? 'transform:translate(-50%,-50%) rotate(45deg);'
    : 'transform:translate(-50%,-50%);';
  const glyph = pending ? '' : glyphFor(status);
  const glyphHtml = glyph
    ? `<span style="${
        offPlan ? 'transform:rotate(-45deg);' : ''
      }display:block;color:#fff;font-size:${Math.round(size * 0.55)}px;line-height:1;font-weight:800;">${glyph}</span>`
    : '';
  return L.divIcon({
    className: 'map-vendor-point',
    html: `<div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;
      border-radius:${shapeRadius};${fillStyle}${rotate}
      box-sizing:border-box;box-shadow:0 0 0 1.5px #fff;
      ${offPlan ? 'outline:1.5px solid var(--map-off-plan);outline-offset:2px;' : ''}
      display:flex;align-items:center;justify-content:center;">${glyphHtml}</div>`,
    iconSize: [total, total],
    iconAnchor: [total / 2, total / 2],
    popupAnchor: [0, -total / 2],
  });
}

/**
 * Marcador de la vista de un vendedor (sección 3.3): el color dice el
 * resultado y el número el orden de visita. `number = null` cuando la
 * última visita la hizo otro vendedor (sin número propio).
 */
export function stopPointIcon(
  status: MapPointStatus,
  number: number | null,
  offPlan: boolean,
): L.DivIcon {
  const pending = status === 'PENDING';
  const colorVar = mapStatusColorVar(status);
  const size = offPlan ? 20 : pending ? 15 : 24;
  const fillStyle = pending
    ? `background:#fff;border:2.5px solid ${colorVar};`
    : `background:${colorVar};`;
  const shapeRadius = offPlan ? '16%' : '50%';
  const rotate = offPlan
    ? 'transform:translate(-50%,-50%) rotate(45deg);'
    : 'transform:translate(-50%,-50%);';
  const numberHtml =
    number != null
      ? `<span style="${
          offPlan ? 'transform:rotate(-45deg);' : ''
        }display:block;color:#fff;font-weight:800;font-size:${Math.max(10, Math.round(size * 0.42))}px;">${number}</span>`
      : '';
  return L.divIcon({
    className: 'map-stop-point',
    html: `<div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;
      border-radius:${shapeRadius};${fillStyle}${rotate}
      box-sizing:border-box;box-shadow:0 0 0 1.5px #fff;
      ${offPlan ? 'outline:1.5px solid var(--map-off-plan);outline-offset:2px;' : ''}
      display:flex;align-items:center;justify-content:center;">${numberHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Banderín de inicio (I) / fin (F) de ruta, en el color del vendedor — sección 3.3. */
export function routeFlagIcon(kind: 'start' | 'end', vendorColorVar: string): L.DivIcon {
  const letter = kind === 'start' ? 'I' : 'F';
  return L.divIcon({
    className: 'map-route-flag',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${vendorColorVar};
      color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;
      font-size:12px;box-shadow:0 0 0 2px #fff;">${letter}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

/**
 * Marcador de la cartera completa (sección 8.3): círculo en el color del
 * vendedor; `scheduledOnDate` lo pinta lleno, el resto con relleno blanco y
 * opacidad 0,6. `visitedStatus` agrega el glifo si ya lo visitaron esa
 * fecha. `covered` (otro vendedor lo cubre) suma el borde punteado.
 */
export function portfolioPointIcon(
  vendorColorVar: string,
  scheduledOnDate: boolean,
  visitedStatus: MapPointStatus | null,
  covered: boolean,
): L.DivIcon {
  const size = 14;
  const fillStyle = scheduledOnDate
    ? `background:${vendorColorVar};opacity:1;`
    : `background:#fff;border:2px solid ${vendorColorVar};opacity:.6;`;
  const glyph = visitedStatus && visitedStatus !== 'PENDING' ? glyphFor(visitedStatus) : '';
  const glyphHtml = glyph
    ? `<span style="display:block;color:${scheduledOnDate ? '#fff' : 'var(--ink)'};font-size:8px;font-weight:800;line-height:1;">${glyph}</span>`
    : '';
  return L.divIcon({
    className: 'map-portfolio-point',
    html: `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:${size}px;height:${size}px;border-radius:50%;${fillStyle}
      box-sizing:border-box;box-shadow:0 0 0 1.5px #fff;
      ${covered ? 'outline:2px dashed var(--ink-muted);outline-offset:2px;' : ''}
      display:flex;align-items:center;justify-content:center;">${glyphHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export interface BatchDrawPoint {
  lat: number;
  lng: number;
  radius: number;
  fillColor: string; // hex ya resuelto (ver resolveCssVar)
  strokeColor: string;
  strokeWeight: number;
  opacity: number;
  /** Grupo al que pertenece (ya decidido por quien arma el punto): permite
   * mostrar/ocultar por capa sin recrear nada (sección 9.4). */
  target: L.LayerGroup;
  /** Id del cliente, para abrir la ventana del punto al hacer click. */
  customerId: number;
}

/**
 * Dibuja puntos de a lotes con `requestAnimationFrame` para no congelar la
 * pantalla con ~10 mil marcadores (sección 12.8, vista Día global). Cada
 * punto es un `L.circleMarker` sobre el renderer de lienzo compartido,
 * agregado directo a su `target` (nunca al mapa): nada de `L.divIcon` acá,
 * es DOM por punto y no escala a ese volumen.
 */
export function drawPointsInBatches(
  renderer: L.Canvas,
  points: BatchDrawPoint[],
  batchSize: number,
  onProgress: (drawn: number, total: number) => void,
  onDone: () => void,
  onClick: (customerId: number, ev: L.LeafletMouseEvent) => void,
): { cancel: () => void } {
  let cancelled = false;
  let index = 0;
  function step() {
    if (cancelled) return;
    const end = Math.min(index + batchSize, points.length);
    for (; index < end; index++) {
      const p = points[index];
      L.circleMarker([p.lat, p.lng], {
        renderer,
        radius: p.radius,
        fillColor: p.fillColor,
        fillOpacity: p.opacity,
        color: p.strokeColor,
        weight: p.strokeWeight,
        stroke: p.strokeWeight > 0,
      })
        .addTo(p.target)
        .on('click', (ev) => onClick(p.customerId, ev));
    }
    onProgress(index, points.length);
    if (index < points.length) {
      requestAnimationFrame(step);
    } else {
      onDone();
    }
  }
  requestAnimationFrame(step);
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}

/** Marcador gris con "?" de un cliente sin vendedor — sección 11. */
export function orphanPointIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-orphan-point',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:var(--map-vendor-none);
      color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;
      font-size:10px;box-shadow:0 0 0 1.5px #fff;">?</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7],
  });
}
