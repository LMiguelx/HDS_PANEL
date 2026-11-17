// Conteo de inventario (solo lectura) — doc 82, sección 6. El panel no
// cuenta, no toma marcas, no libera ni finaliza: solo muestra lo que el
// almacenero hace desde la app (doc 81).

export type BrandCountStatus = 'FREE' | 'IN_PROGRESS' | 'RELEASED' | 'CLOSED';

/** Fila de la pizarra — GET /api/stock-counts/board?warehouseId= — sección 6.2. */
export interface BrandCountBoardRow {
  brandId: number;
  brandCode: string;
  brandName: string;
  totalProducts: number;
  status: BrandCountStatus;
  stockCountId: number | null; // null si FREE
  userId: number | null; // no mostrar
  userName: string | null; // null si FREE o RELEASED
  mine: boolean; // ignorar en el panel
  active: boolean; // el almacenero escaneó en los últimos 10 minutos
  countedProducts: number;
  startedAt: string | null;
  lastActivityAt: string | null;
  closedAt: string | null; // solo CLOSED
}

export type StockCountStatus = 'OPEN' | 'CLOSED';

/** Cabecera de un conteo — GET /api/stock-counts/{id} — sección 6.3. */
export interface StockCountView {
  stockCountId: number;
  warehouseId: number;
  warehouseName: string;
  userId: number | null; // null = liberado
  userName: string | null; // null = liberado
  brandId: number;
  brandName: string;
  totalProducts: number;
  countedProducts: number;
  status: StockCountStatus;
  startedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string | null;
  erpTaken: boolean;
}

export interface CountSummary {
  totalProducts: number;
  pending: number;
  done: number;
  notFound: number;
}

export type CountLineStatus = 'PENDING' | 'DONE' | 'NOT_FOUND';
export type CountEntryMethod = 'SCAN' | 'MANUAL';

export interface CountProductLine {
  productId: number; // no mostrar
  productCode: string;
  productName: string;
  hasBarcode: boolean; // false = se cuenta a mano en la app
  unitOfMeasure: string;
  unitsPerPackage: number | null;
  erpStock: number | null; // en unidades; null = el ERP no subió ese producto
  erpStockAt: string | null;
  countedPackages: number | null; // null si PENDING
  countedUnits: number | null; // null si PENDING
  countedQuantity: number | null; // total en unidades; null si PENDING
  difference: number | null; // erpStock − countedQuantity; null si PENDING o sin erpStock
  status: CountLineStatus;
  entryMethod: CountEntryMethod | null; // null si PENDING
  countedByName: string | null;
  countedAt: string | null;
}

export interface StockCountDetailResponse {
  header: StockCountView;
  mine: boolean; // ignorar en el panel (siempre solo lectura)
  active: boolean;
  summary: CountSummary;
  products: CountProductLine[]; // TODOS los productos, por nombre
}
