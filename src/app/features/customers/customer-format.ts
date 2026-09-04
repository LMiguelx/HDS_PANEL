const FULL_STAR = '★';
const EMPTY_STAR = '☆';

/** "★★★★☆ (4/5)" · "Sin calificar" si es null. */
export function ratingText(rating: number | null | undefined): string {
  if (rating == null) return 'Sin calificar';
  const stars = FULL_STAR.repeat(rating) + EMPTY_STAR.repeat(5 - rating);
  return `${stars} (${rating}/5)`;
}
