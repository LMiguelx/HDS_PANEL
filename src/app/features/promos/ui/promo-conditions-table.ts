import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { UiBadge } from '../../../shared/ui/badge/badge';
import { ConditionGroupView, ConditionView } from '../promo.types';

/**
 * Tabla "Qué debe comprar" — doc 45, sección 1 y 2.3.2; doc 57, secciones 7
 * y 8: columna "Obligatorio" con la insignia ámbar de `requiredText` cuando
 * la línea es obligatoria. Con subgrupos (doc 90, sección 6): una tabla por
 * subgrupo, con `ConditionGroupView.text` tal cual como cabecera. Sin
 * cabecera de tarjeta: la pone quien la usa.
 */
@Component({
  selector: 'app-promo-conditions-table',
  imports: [UiBadge, NgTemplateOutlet],
  template: `
    @if (promoType() === 'CUSTOMER_LIST') {
      <p class="pct-empty">No exige compra: se otorga por estar en la lista.</p>
    } @else if (!conditions()?.length) {
      <p class="pct-empty">Cualquier compra que llegue al total mínimo del tramo.</p>
    } @else if (conditionGroups()?.length) {
      <div class="pct-groups">
        @for (g of conditionGroups(); track g.groupNumber) {
          <div class="pct-group">
            <div class="pct-group-head">{{ g.text }}</div>
            <ng-container
              *ngTemplateOutlet="table; context: { $implicit: linesOf(g.groupNumber) }"
            />
          </div>
        }
      </div>
    } @else {
      <ng-container *ngTemplateOutlet="table; context: { $implicit: conditions() }" />
    }

    <ng-template #table let-rows>
      <table class="ui-table-grid pct-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Código</th>
            <th>Producto</th>
            <th>Obligatorio</th>
          </tr>
        </thead>
        <tbody>
          @for (c of rows; track c.lineNumber) {
            <tr>
              <td class="pct-muted">{{ c.scopeName || c.scope }}</td>
              <td class="pct-muted">{{ c.productCode || '—' }}</td>
              <td>{{ c.productName || c.familyName || c.brandName }}</td>
              <td>
                @if (c.required && c.requiredText) {
                  <ui-badge tone="warning">{{ c.requiredText }}</ui-badge>
                } @else {
                  <span class="pct-muted">—</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </ng-template>
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
      .pct-groups {
        display: grid;
        gap: var(--sp-5);
      }
      .pct-group-head {
        font-weight: 800;
        font-size: var(--fs-body);
        color: var(--ink);
        margin-bottom: 8px;
      }
    `,
  ],
})
export class PromoConditionsTable {
  conditions = input<ConditionView[] | null | undefined>(null);
  conditionGroups = input<ConditionGroupView[] | null | undefined>(null);
  promoType = input<string | null | undefined>(null);

  protected linesOf = (groupNumber: number) =>
    (this.conditions() ?? []).filter((c) => c.groupNumber === groupNumber);
}
