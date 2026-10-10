/**
 * Redondea a 2 decimales — el backend rechaza cantidades con más
 * (pedidos, dotación, ajuste de stock); el panel normaliza en el input
 * para no mandar nunca un valor inválido (doc 36, sección 7).
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
