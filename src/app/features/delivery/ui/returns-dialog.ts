import { Component, inject } from '@angular/core';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { ReturnsSection } from './returns-section';

export interface ReturnsDialogData {
  invoiceId: string;
  customerName: string;
}

/** Devoluciones registradas sobre un comprobante — solo lectura (sin endpoint de creación en este panel). */
@Component({
  selector: 'app-returns-dialog',
  imports: [ReturnsSection],
  template: `
    <div class="rd">
      <h2 class="rd-title">Devoluciones</h2>
      <p class="rd-sub">{{ data.customerName }} · {{ data.invoiceId }}</p>
      <app-returns-section [invoiceId]="data.invoiceId" />
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px; max-height:80vh; overflow-y:auto;',
  },
  styles: [
    `
      .rd {
        display: grid;
        gap: 16px;
      }
      .rd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .rd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class ReturnsDialog {
  protected data = inject<ReturnsDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
}
