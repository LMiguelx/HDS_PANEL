// Nombre del archivo exportado — doc 43, sección 8.7. `ExportTable.fileName`
// va SIN extensión: el formato (.xlsx/.csv) lo agrega `TableExporter` al
// descargar, según lo elegido en el menú.
const MAX_LENGTH = 100;

function slugifyPart(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes y la virgulilla de la ñ
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Arma el nombre a partir de partes (cada una se pasa por `slugifyPart`),
 * en minúsculas, sin tildes ni espacios (guiones), máximo 100 caracteres.
 * `parts` vacías o que queden vacías al limpiarlas se omiten, sin dejar
 * `__` dobles.
 */
export function exportFileName(parts: (string | null | undefined)[]): string {
  const slug = parts
    .filter((p): p is string => !!p)
    .map(slugifyPart)
    .filter(Boolean)
    .join('_');
  return slug.length > MAX_LENGTH ? slug.slice(0, MAX_LENGTH).replace(/[-_]+$/, '') : slug;
}
