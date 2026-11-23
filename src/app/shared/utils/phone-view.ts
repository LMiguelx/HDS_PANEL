// Teléfonos guardados sin formato: espacios, puntos, guiones, saltos de
// línea y textos como "true" o "NO" — doc 95, parte 1. Nunca lanza error ni
// usa `parseInt`/libphonenumber sobre el valor guardado: solo decide si se
// ve "normal" o si hay que avisar para que lo corrijan.

export interface PhoneView {
  text: string;
  needsReview: boolean;
}

export function phoneView(raw: string | null | undefined): PhoneView {
  const value = (raw ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!value) return { text: '—', needsReview: true };
  if (/^\d{9}$/.test(value)) {
    return { text: value.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'), needsReview: false };
  }
  if (/^\+?\d{6,15}$/.test(value)) return { text: value, needsReview: false };
  return { text: value, needsReview: true };
}

/** Mismas reglas que aplica el backend al guardar — doc 95, parte 1: quita espacios, puntos, guiones, paréntesis y saltos de línea, dejando solo los dígitos (y el `+` inicial). */
export function normalizePhoneForCompare(raw: string): string {
  return raw.replace(/[\s.\-()]/g, '');
}

/** Validación de ayuda en el panel (la real la hace el backend) — doc 95, parte 1.4. */
export function isValidPhoneFormat(raw: string): boolean {
  return /^\+?\d{6,15}$/.test(normalizePhoneForCompare(raw));
}
