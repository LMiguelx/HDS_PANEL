import { UbigeoView } from '../models/customer-request.models';
import { UbigeoDepartmentView } from '../models/catalog.models';

/** Aplana el arreglo departamentos→provincias→distritos de GET /catalog/ubigeos — doc 74, sección 2.3.1. */
export function flattenUbigeoTree(departments: UbigeoDepartmentView[]): UbigeoView[] {
  return departments.flatMap((d) =>
    d.provinces.flatMap((p) =>
      p.districts.map((x) => ({
        ubigeoCode: x.ubigeoCode,
        district: x.district,
        province: p.province,
        department: d.department,
      })),
    ),
  );
}

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
