import { Component, computed, input } from '@angular/core';

const NORMALIZED_MAP: Record<string, string> = {
  vigente: 'vigente',
  programada: 'programada',
  vencida: 'vencida',
  apagada: 'apagada',
  pendiente: 'pendiente',
  'sin stock': 'sin-stock',
  agotado: 'sin-stock',
  // Planilla de reparto (delivery_batch_status)
  abierta: 'open',
  'en ruta': 'in-route',
  liquidada: 'settled',
  // Ítem de planilla (delivery_item_status) — "Pendiente" reutiliza el slug
  // de arriba a propósito, mismo matiz visual.
  entregado: 'delivered',
  'entrega parcial': 'partial',
  rechazado: 'rejected',
  // Conciliación de factura (invoice_match_status)
  'sin conciliar': 'unmatched',
  'conciliado automáticamente': 'matched-auto',
  'conciliado manualmente': 'matched-manual',
  'con diferencias': 'mismatch',
  // Pedido (order_status) — reutiliza los slugs open/in-route/delivered/
  // partial/rejected ya definidos arriba (mismos tokens de color).
  abierto: 'open',
  'enviado a facturación': 'sent-to-billing',
  'entregado en mostrador': 'counter-delivered',
  anulado: 'cancelled',
  // Visita (customer_visit_status) — doc 42, secciones 3.3 y 6.4. "Pendiente"
  // a secas no se mapea acá: choca con el "Pendiente" de Promoción
  // (--st-pendiente, otro color) — una visita pendiente siempre fuerza
  // `[status]="'pending-visit'"` en vez de confiar en el label.
  atendido: 'attended',
  'no compró': 'no-purchase',
  cerrado: 'closed',
  'pendiente de visitar': 'pending-visit',
};

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Cuadro de color + palabra. El estado nunca se comunica solo con color.
 * `label` es el texto que arma el backend (statusLabel) y se pinta tal cual;
 * `status` es opcional y solo sirve para forzar el color cuando el texto no
 * coincide con el vocabulario esperado.
 */
@Component({
  selector: 'ui-status',
  template: `
    <span class="ui-status">
      <span class="ui-status-dot" [style.background]="dotColor()"></span>
      {{ label() }}
    </span>
  `,
  styles: [
    `
      .ui-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
      }
      .ui-status-dot {
        width: 8px;
        height: 8px;
        flex: none;
      }
    `,
  ],
})
export class UiStatus {
  label = input.required<string>();
  status = input<string>('');

  protected dotColor = computed(() => {
    const key = normalize(this.status() || this.label());
    const slug = NORMALIZED_MAP[key] ?? 'pendiente';
    return `var(--st-${slug})`;
  });
}
