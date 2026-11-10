import { UbigeoView } from '../models/customer-request.models';
import { UbigeoTreeDepartmentView } from '../models/catalog.models';

function pick(...values: (string | undefined)[]): string {
  return values.find((v) => !!v) ?? '';
}

/** Aplana el árbol department→provinces→districts de GET /catalog/ubigeos — doc 74, sección 2.3.1. */
export function flattenUbigeoTree(department: UbigeoTreeDepartmentView): UbigeoView[] {
  const departmentName = pick(department.departmentName, department.name);
  const districts: UbigeoView[] = [];
  for (const province of department.provinces ?? []) {
    const provinceName = pick(province.provinceName, province.name);
    for (const district of province.districts ?? []) {
      districts.push({
        ubigeoCode: pick(district.ubigeoCode, district.code),
        district: pick(district.districtName, district.name),
        province: provinceName,
        department: departmentName,
      });
    }
  }
  return districts;
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
