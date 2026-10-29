/** Peso — 1 decimal + kg (sección 2.4 del doc). */
export function weightText(kg: number | null | undefined): string {
  if (kg == null) return '—';
  return `${kg.toFixed(1)} kg`;
}

/** Cantidad — sin ceros sobrantes, hasta 3 decimales (sección 2.4 del doc). */
export function quantityText(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(Math.round(value * 1000) / 1000);
}
