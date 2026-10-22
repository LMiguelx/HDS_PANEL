import { UbigeoView } from '../models/customer-request.models';

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "Distrito · Provincia" — doc 39, sección 3.6. "Sin ubigeo" si es null. */
export function ubigeoText(ubigeo: UbigeoView | null): string {
  if (!ubigeo) return 'Sin ubigeo';
  return `${titleCase(ubigeo.district)} · ${titleCase(ubigeo.province)}`;
}

/** Enlace de Google Maps para "Ver en el mapa" — doc 39, sección 3.3. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
