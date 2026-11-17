// Contratos de Recepción de mercadería — doc 58. Módulo nuevo: ningún tipo
// viene de shared/models (ARCHITECTURE_PANEL.md, sección 7 — "modelos
// nuevos nacen en features/<x>/domain/").

/** Estado de la entrega — doc 58, sección 4.1. */
export type ReceiptStatusCode = 'IN_REVIEW' | 'CONFIRMED' | 'CANCELLED';

/** Tipo de documento — doc 58, sección 4.3. */
export type DocumentTypeCode = 'INVOICE' | 'DELIVERY_NOTE' | 'CREDIT_NOTE' | 'ENTRY_NOTE';

/** Unidad de la planilla — doc 58, sección 4.4. */
export type ReceiptUnitType = 'UNIT' | 'PACKAGE';

/** Severidad de una observación — doc 58, sección 4.6. */
export type ReceiptIssueSeverity = 'BLOCKING' | 'WARNING';

/** Selector de marca del filtro — GET /goods-receipts/brands, sección 6.1. */
export interface ReceiptBrandOption {
  brandId: number; // NO mostrar (valor del selector)
  brandCode: string;
  brandName: string;
  configured: boolean;
}

export interface ReceiptListFilters {
  brandId?: number;
  warehouseId?: number;
  createdBy?: number;
  statusCode?: ReceiptStatusCode;
  q?: string;
  erpTaken?: boolean;
  from?: string; // yyyy-MM-dd
  to?: string;
  page?: number;
  size?: number;
}

/** Fila del listado — doc 58, sección 6.2. */
export interface ReceiptSummary {
  receiptId: number; // mostrar como "N.° de entrega"; abre el detalle
  brandId: number; // NO mostrar
  brandName: string;
  warehouseName: string;
  supplierName: string | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  statusCode: ReceiptStatusCode;
  statusName: string;
  lineCount: number;
  linesSubtotal: number;
  erpTaken: boolean;
  createdByName: string;
  createdAt: string;
}

/** Detalle de una entrega — doc 58, sección 7.1. */
export interface ReceiptDetail {
  receiptId: number; // mostrar como "Entrega N.° {receiptId}"
  brandId: number; // NO mostrar (sirve para cargar los productos, 7.5)
  brandName: string;
  warehouseId: number; // NO mostrar (valor del selector de almacén)
  warehouseName: string;
  supplierName: string | null;
  ruc: string | null;
  documentTypeCode: DocumentTypeCode | null;
  documentTypeName: string | null;
  documentNumber: string | null;
  unitType: ReceiptUnitType;
  pricesIncludeTax: boolean;
  totalAmount: number | null;
  taxAmount: number | null;
  linesSubtotal: number;
  statusCode: ReceiptStatusCode;
  statusName: string;
  erpTaken: boolean;
  erpTakenAt: string | null;
  createdBy: number; // NO mostrar
  createdByName: string;
  createdAt: string;
  updatedAt: string; // GUARDAR: se envía como expectedUpdatedAt al guardar
  confirmedByName: string | null;
  confirmedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  lines: ReceiptLineView[];
  issues: ReceiptIssueView[]; // solo en revisión; vacío en confirmada/anulada
  canConfirm: boolean; // true = en revisión y sin observaciones bloqueantes
}

/** De dónde salió el producto de la línea — doc 71, sección 1.1. */
export type MatchSource = 'CODE' | 'OWN_CODE' | 'NAME' | 'SUGGESTED' | 'ACCEPTED' | 'MANUAL';

export interface ReceiptLineView {
  lineNumber: number; // mostrar como "#"; GUARDAR para enviarlo al editar
  productCode: string | null; // null = sin emparejar
  productName: string | null;
  unitsPerPackage: number | null;
  supplierCode: string | null;
  supplierDescription: string | null;
  quantity: number | null;
  quantityInUnits: number | null; // solo si la planilla es PACKAGE
  unitCost: number | null;
  subtotal: number | null;
  bonus: boolean;
  aiRead: boolean; // sección 4.5
  edited: boolean; // sección 4.5
  purchaseUnitCost: number | null; // costo de compra del ERP, sin IGV (referencia)
  purchasePackageCost: number | null; // costo de compra por paquete, sin IGV (referencia)
  // — doc 71, sección 1.1 —
  discountAmount: number; // 0 si la fila no tiene descuento
  netUnitCost: number | null; // subtotal / cantidad: costo real de la unidad de compra
  matchSource: MatchSource | null; // de dónde salió el producto; null = sin producto
  suggestedProductCode: string | null; // lo que sugirió la lectura (se conserva aunque se cambie)
  suggestedProductName: string | null;
  suggestionConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

export interface ReceiptIssueView {
  lineNumber: number | null; // null = cabecera o documento
  code: string; // NO mostrar (sirve para ubicar el campo, sección 4.6)
  message: string; // MOSTRAR tal cual
  severity: ReceiptIssueSeverity;
}

/** PUT /goods-receipts/{receiptId} — doc 58, sección 7.4. */
export interface UpdateReceiptCommand {
  expectedUpdatedAt: string; // OBLIGATORIO: el updatedAt del detalle cargado
  warehouseId: number; // OBLIGATORIO
  supplierName: string | null;
  ruc: string | null;
  documentTypeCode: DocumentTypeCode | null;
  documentNumber: string | null;
  unitType: ReceiptUnitType; // OBLIGATORIO
  pricesIncludeTax: boolean;
  totalAmount: number | null;
  taxAmount: number | null;
  lines: ReceiptLineInput[]; // OBLIGATORIO (puede ser vacía); máx. 300
}

export interface ReceiptLineInput {
  lineNumber: number | null; // existente = corrige esa línea; null = línea nueva
  productCode: string | null; // código Hispánica; null = sin emparejar
  supplierCode: string | null;
  supplierDescription: string | null;
  quantity: number | null;
  unitCost: number | null;
  discountAmount: number | null; // doc 71, sección 1.2. null = 0. No negativo. Siempre se reenvía.
  subtotal: number | null;
  bonus: boolean;
  suggestionAccepted: boolean; // doc 71, sección 1.2. true = acepta el producto sugerido de esta línea
}

/** Perfil de recepción de la marca — doc 58, sección 8.2. */
export interface ProfileView {
  brandId: number; // NO mostrar
  ruc: string;
  unitType: ReceiptUnitType;
  pricesIncludeTax: boolean;
  usesProductCodes: boolean;
  updatedByName: string;
  updatedAt: string;
}

/** Productos de la marca para elegir — GET …/brands/{brandId}/context, sección 7.5. */
export interface BrandProductView {
  productCode: string; // valor del selector y lo que se envía
  productName: string;
  unitOfMeasure: string;
  unitsPerPackage: number | null;
  bonusEligible: boolean;
  purchaseUnitCost: number | null; // sin IGV
  purchasePackageCost: number | null; // sin IGV
  purchaseCostUpdatedAt: string | null;
}

export interface BrandReceiptContext {
  brandId: number; // NO mostrar
  brandName: string;
  profile: ProfileView | null; // null si la marca no tiene perfil
  products: BrandProductView[];
}

/** Fila de Configuración por marca — GET /goods-receipts/config/brands, sección 8.1. */
export interface BrandReceiptConfigRow {
  brandId: number; // NO mostrar
  brandCode: string;
  brandName: string;
  configured: boolean;
  ruc: string | null;
  unitType: ReceiptUnitType | null;
  pricesIncludeTax: boolean | null;
  usesProductCodes: boolean | null;
  activeProducts: number;
  activeEquivalences: number;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** PUT /goods-receipts/config/brands/{brandId}/profile — doc 58, sección 8.2. */
export interface UpsertProfileCommand {
  ruc: string; // OBLIGATORIO, 11 dígitos
  unitType: ReceiptUnitType; // OBLIGATORIO
  pricesIncludeTax: boolean;
  usesProductCodes: boolean;
}

/** Serie de documento de la marca — doc 72, sección 2.2. */
export interface SeriesView {
  seriesId: number; // NO mostrar
  documentTypeCode: string; // INVOICE | DELIVERY_NOTE | CREDIT_NOTE | ENTRY_NOTE
  documentTypeName: string; // mostrar: Factura, Guía de remisión, Nota de crédito, Nota de ingreso
  series: string; // FO01
  origin: 'MANUAL' | 'LEARNED';
  learnedReceiptId: number | null; // la entrega de la que se aprendió
  learnedDocumentNumber: string | null; // su número, por ejemplo FO01-00116580
  active: boolean;
  createdByName: string;
  createdAt: string; // ISO
  updatedAt: string | null;
}

export interface CreateSeriesCommand {
  documentTypeCode: string; // obligatorio
  series: string; // obligatorio: 4 letras o números (se guarda en mayúsculas)
}

export interface ChangeSeriesCommand {
  series: string;
}

/** Equivalencia proveedor → producto — doc 58, sección 8.3. */
export interface EquivalenceView {
  equivalenceId: number; // NO mostrar
  supplierCode: string | null; // null = equivalencia por descripción
  supplierDescription: string | null;
  productCode: string;
  productName: string;
  active: boolean;
  createdByName: string;
  createdAt: string;
}

export interface CreateEquivalenceCommand {
  supplierCode: string | null; // máx. 30; al menos uno de los dos
  supplierDescription: string | null; // máx. 200
  productCode: string; // OBLIGATORIO
}

export interface ChangeEquivalenceCommand {
  productCode: string; // OBLIGATORIO
}

/** Error 400 con `errors: { campo: mensaje }` — doc 58, secciones 10. */
export interface FieldErrorsBody {
  detail?: string;
  errors?: Record<string, string>;
}

/** Error 409 al confirmar, con `issues` — doc 58, sección 10. */
export interface ConfirmIssuesErrorBody {
  detail?: string;
  issues?: ReceiptIssueView[];
}
