import { Component, input } from '@angular/core';
import { ErpTone } from '../request-format';

/**
 * Etiqueta del estado del ERP ("Esperando ERP" / "Lista para aprobar" / "ERP
 * 1 de 3"), repetida en la fila y el detalle de las tres pestañas de
 * Aprobaciones — doc 39, sección 3.1. Ámbar mientras se espera, verde
 * cuando ya se puede aprobar: nunca es un error, así que no usa
 * `--status-danger`.
 */
@Component({
  selector: 'app-erp-badge',
  template: `
    <span class="erp-badge" [class]="'erp-badge-' + tone()">
      <span class="erp-badge-dot"></span>
      {{ label() }}
    </span>
  `,
  styles: [
    `
      .erp-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fs-dense);
        font-weight: 700;
        white-space: nowrap;
      }
      .erp-badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .erp-badge-ok {
        color: var(--status-ok);
      }
      .erp-badge-ok .erp-badge-dot {
        background: var(--status-ok);
      }
      .erp-badge-warn {
        color: var(--status-warn);
      }
      .erp-badge-warn .erp-badge-dot {
        background: var(--status-warn);
      }
    `,
  ],
})
export class ErpBadge {
  label = input.required<string>();
  tone = input<ErpTone>('warn');
}
