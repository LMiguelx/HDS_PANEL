/**
 * Redondea a 2 decimales — el backend rechaza cantidades con más
 * (pedidos, dotación, ajuste de stock); el panel normaliza en el input
 * para no mandar nunca un valor inválido (doc 36, sección 7).
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * true si la cantidad es un número entero. En pedidos y dotación no se
 * vende fraccionado: siempre es unidad o paquete (doc 37, sección 6.4).
 */
export function isWholeQuantity(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * Normaliza la cantidad escrita en un input de pedido o dotación: la
 * redondea al entero más cercano y la deja entre `min` y `max`.
 * Devuelve null si no es un número finito, para que quien llama conserve
 * el valor anterior en vez de mandar algo inválido.
 */
export function toWholeQuantity(
  value: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.round(value), min), max);
}
