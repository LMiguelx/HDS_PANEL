/** Solo dígitos, máximo 10 — doc 75, sección 1. */
export function sanitizeCustomerCodeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

/** Completa con ceros a la izquierda si tiene de 1 a 9 dígitos — doc 75, sección 1. */
export function padCustomerCode(code: string): string {
  return code.length > 0 && code.length < 10 ? code.padStart(10, '0') : code;
}
