const FULL_STAR = '★';
const EMPTY_STAR = '☆';

/** "CM" de "Calapuja Mamani Valentina" — iniciales de las dos primeras palabras. */
export function initials(businessName: string): string {
  const words = businessName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** "★★★★☆ (4/5)" · "Sin calificar" si es null. */
export function ratingText(rating: number | null | undefined): string {
  if (rating == null) return 'Sin calificar';
  const stars = FULL_STAR.repeat(rating) + EMPTY_STAR.repeat(5 - rating);
  return `${stars} (${rating}/5)`;
}
