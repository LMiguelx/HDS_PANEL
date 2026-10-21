import { Component, input } from '@angular/core';
import { ConditionView } from '../promo.types';

/** Tabla "Qué debe comprar" — doc 45, sección 1 y 2.3.2. Sin cabecera de tarjeta: la pone quien la usa. */
@Component({
  selector: 'app-promo-conditions-table',
  template: `
    @if (promoType() === 'CUSTOMER_LIST') {
      <p class="pct-empty">No exige compra: se otorga por estar en la lista.</p>
    } @else if (!conditions()?.length) {
      <p class="pct-empty">Cualquier compra que llegue al total mínimo del tramo.</p>
    } @else {
      <table class="ui-table-grid pct-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Código</th>
            <th>Producto</th>
          </tr>
        </thead>
        <tbody>
          @for (c of conditions(); track c.lineNumber) {
            <tr>
              <td class="pct-muted">{{ c.scopeName || c.scope }}</td>
              <td class="pct-muted">{{ c.productCode || '—' }}</td>
              <td>{{ c.productName || c.familyName || c.brandName }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: [
    `
      .pct-table {
        width: 100%;
      }
      .pct-muted {
        color: var(--ink-muted);
      }
      .pct-empty {
        margin: 0;
        font-size: var(--fs-body);
        color: var(--ink-muted);
      }
    `,
  ],
})
export class PromoConditionsTable {
  conditions = input<ConditionView[] | null | undefined>(null);
  promoType = input<string | null | undefined>(null);
}
