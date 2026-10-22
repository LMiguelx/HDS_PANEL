export interface PageResponse<T> {
  content: T[];
  page: number; // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/**
 * Página sin total — para colas de trabajo que se encogen mientras se
 * resuelven (un total fijo mentiría apenas se arregla una fila). `hasNext`
 * reemplaza a `totalPages`/`totalElements`.
 */
export interface SliceResponse<T> {
  content: T[];
  page: number; // 0-based
  size: number;
  hasNext: boolean;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}
