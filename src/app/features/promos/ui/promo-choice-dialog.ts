import { Component, inject } from '@angular/core';
import { UiDialogRef, UI_DIALOG_DATA } from '../../../shared/ui/dialog/dialog';
import { PromoChoiceCard } from './promo-choice-card';
import { PendingChoiceView } from '../promo.types';

export type PromoChoiceDialogResult = 'resolved' | 'declined' | 'stale';

/**
 * Envoltorio de diálogo para `app-promo-choice-card` — doc 47, secciones
 * 9.5, 10.3 y 12.2: "Resolver" un premio pendiente desde el alcance de la
 * promoción o el detalle del pedido abre esta misma tarjeta en un panel
 * flotante (no hay un componente de panel lateral propio en el sistema: se
 * reutiliza el diálogo, igual que el resto del panel).
 */
@Component({
  selector: 'app-promo-choice-dialog',
  imports: [PromoChoiceCard],
  template: `
    <div class="pcd-wrap">
      <app-promo-choice-card
        [item]="data"
        (resolved)="close('resolved')"
        (declined)="close('declined')"
        (stale)="close('stale')"
      />
    </div>
  `,
  styles: [
    `
      .pcd-wrap {
        padding: var(--sp-5);
      }
    `,
  ],
})
export class PromoChoiceDialog {
  protected data = inject<PendingChoiceView>(UI_DIALOG_DATA);
  private ref = inject(UiDialogRef<PromoChoiceDialogResult>);

  protected close(result: PromoChoiceDialogResult) {
    this.ref.close(result);
  }
}
