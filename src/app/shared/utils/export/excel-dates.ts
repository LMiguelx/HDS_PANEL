// Fechas y horas para celdas de Excel — doc 95, parte 3. ExcelJS/SheetJS
// escriben los `Date` en UTC: un `Date` armado con el constructor local (o
// con `new Date(isoString)` sin zona) queda 5 horas corrido en Lima
// (UTC-5). La solución es construirlo con `Date.UTC` a partir de los
// números de reloj, para que Excel muestre exactamente esos números.

/** "2026-11-20" -> Date que Excel muestra como 20/11/2026 00:00 (sin desfase). */
export function excelDate(isoDate: string | null | undefined): Date | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-11-20" + "07:57" (o "2026-11-20T07:57:00") -> Excel muestra 07:57 exacto. */
export function excelDateTime(isoDate: string, time?: string | null): Date | null {
  const t = time ?? (isoDate.includes('T') ? isoDate.split('T')[1] : null);
  if (!t) return excelDate(isoDate);
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const [hh, mm, ss] = t.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss || 0));
}
