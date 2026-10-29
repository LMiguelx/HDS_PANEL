// Validación de stock — doc 56, secciones 4.1 y 10. Etiquetas, tonos y
// textos de ayuda; todo lo demás (contadores, estado) llega listo del
// servidor.
import { StockValidationRow, StockValidationStatus } from '../../shared/models/sales-report.models';
import { BadgeTone, BADGE_TONE_VAR } from '../inventory/inventory-format';

export { BADGE_TONE_VAR };
export type { BadgeTone };

const STATUS_TONE: Record<StockValidationStatus, BadgeTone> = {
  SHORTFALL: 'red',
  NO_ERP_STOCK: 'gray',
  OK: 'green',
};

export function statusLabel(row: StockValidationRow): string {
  switch (row.status) {
    case 'SHORTFALL':
      return `Faltan ${row.shortfallQuantity}`;
    case 'NO_ERP_STOCK':
      return 'Sin stock del ERP';
    default:
      return 'Alcanza';
  }
}

export function statusTone(row: StockValidationRow): BadgeTone {
  return STATUS_TONE[row.status];
}

export const TIP = {
  toBillQuantity:
    'Lo que los pedidos ya descontaron y el ERP todavía no factura. Incluye pedidos de días anteriores.',
  pendingQuantity: 'Bonificaciones que quedaron sin stock. El ERP también las va a facturar.',
  erpStock: 'Lo que informó el ERP en su última actualización.',
  availableQuantity:
    'Lo que queda en el ERP después de facturar todo. Si es negativo, faltan unidades.',
  shortfallCard:
    'Productos donde los pedidos suman más de lo que tiene el ERP. Esos pedidos no se pueden enviar a facturar.',
  advanceNotBackedCard: 'Hay un adelanto, pero el ERP no registró esa mercadería.',
  staleCard:
    'El producto no vino en la última actualización del ERP. Vuelva a actualizar desde el ERP.',
  appExcessCard:
    'La app tiene unidades que el ERP no tiene. Se corrigen solas en la próxima actualización del ERP.',
  pendingClock: 'Pendiente de stock',
};

export function panelHeadlineText(row: StockValidationRow): string {
  switch (row.status) {
    case 'SHORTFALL':
      return `Faltan ${row.shortfallQuantity} — reduzca uno o más pedidos hasta que alcance.`;
    case 'NO_ERP_STOCK':
      return 'El ERP no ha subido este producto: no se puede validar.';
    default:
      return 'Alcanza el stock del ERP para todos estos pedidos.';
  }
}

export function advanceNotBackedText(row: StockValidationRow): string {
  return `Hay un adelanto de ${row.openAdvanceQuantity} que el ERP no registró. Si la mercadería llegó, regístrela en el ERP y vuelva a actualizar.`;
}
