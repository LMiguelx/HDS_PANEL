// Tipos del exportador compartido — doc 43, sección 8.2.

export type ExportFormat = 'xlsx' | 'csv';

export type ColumnType =
  | 'text' // texto libre
  | 'code' // código: SIEMPRE texto, conserva ceros a la izquierda
  | 'integer' // 0 decimales
  | 'money' // 2 decimales, separador de miles
  | 'quantity' // hasta 3 decimales, sin ceros sobrantes
  | 'weight' // 1 decimal
  | 'date' // dd/MM/yyyy
  | 'datetime' // dd/MM/yyyy HH:mm
  | 'time'; // HH:mm

export interface ExportColumn<T> {
  key: string; // identificador estable de la columna
  header: string; // texto del encabezado ("Venta campo S/")
  type: ColumnType;
  value: (row: T, index: number) => unknown; // valor CRUDO, sin formatear
  width?: number; // ancho sugerido en caracteres (opcional)
  bold?: boolean; // resaltar (ej. Neto, Venta total)
  emptyWhenZero?: boolean; // mostrar vacío en vez de 0 (ej. columnas de mostrador)
}

export interface ExportTable<T> {
  title: string; // "Liquidación de vendedores"
  subtitle?: string; // "301 TURPO QUILLA DIOGENES"
  filters: { label: string; value: string }[]; // [{ label: 'Desde', value: '01/10/2026' }, …]
  columns: ExportColumn<T>[]; // SOLO las visibles, en el orden de la pantalla
  rows: T[];
  totals?: Partial<Record<string, unknown>>; // por key de columna; del backend
  totalsLabel?: string; // "Sumas"
  footnote?: string; // "Último pedido registrado a las 15:17 del 21/10/2026"
  fileName: string; // sin extensión (sección 8.7)
  sheetName?: string; // por defecto, el title recortado
}
