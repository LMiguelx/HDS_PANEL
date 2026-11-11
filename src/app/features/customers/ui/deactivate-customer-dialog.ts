import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../../shared/ui/button/button';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { CustomerService } from '../customer';
import { CustomerDetail } from '../../../shared/models/customer.models';

export interface DeactivateCustomerDialogData {
  customerId: number;
  businessName: string;
}

/**
 * Confirmación de Desactivar — doc 68, sección 8.2. Si el cliente tiene
 * pedidos abiertos el servidor responde 409: el modal se queda abierto
 * mostrando el `detail` y un enlace a sus pedidos, no se cierra como un
 * error cualquiera.
 */
@Component({
  selector: 'app-deactivate-customer-dialog',
  imports: [UiButton, UiModal],
  template: `
    <ui-modal [title]="'¿Desactivar a ' + data.businessName + '?'" (close)="ref.close(null)">
      <div class="dcd">
        <p class="dcd-text">
          Saldrá de la ruta y la cartera de su vendedor y del mapa, y no se le podrán registrar
          pedidos hasta que se active.
        </p>
        <p class="dcd-text">Su vendedor y horario se conservan en pausa.</p>

        @if (error()) {
          <div class="dcd-error">
            {{ error() }}
            @if (showOrdersLink()) {
              <button type="button" class="dcd-link" (click)="goToOrders()">
                Ver pedidos del cliente
              </button>
            }
          </div>
        }
      </div>

      <ng-container modalFooter>
        <button uiButton variant="secondary" (click)="ref.close(null)">Cancelar</button>
        <button
          uiButton
          variant="secondary"
          class="dcd-danger"
          [loading]="saving()"
          (click)="submit()"
        >
          Desactivar
        </button>
      </ng-container>
    </ui-modal>
  `,
  styles: [
    `
      .dcd {
        display: grid;
        gap: 10px;
      }
      .dcd-text {
        margin: 0;
        font-size: 14px;
        color: var(--ink);
        line-height: 1.5;
      }
      .dcd-error {
        padding: 10px 14px;
        border: 1px solid var(--status-danger);
        background: color-mix(in srgb, var(--status-danger) 8%, transparent);
        font-size: 13px;
        color: var(--ink);
      }
      .dcd-link {
        display: block;
        margin-top: 6px;
        appearance: none;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .dcd-link:hover {
        text-decoration: underline;
      }
      .dcd-danger {
        border-color: var(--status-danger) !important;
        color: var(--status-danger) !important;
      }
      .dcd-danger:hover {
        background: color-mix(in srgb, var(--status-danger) 10%, transparent) !important;
      }
    `,
  ],
})
export class DeactivateCustomerDialog {
  protected data = inject<DeactivateCustomerDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<CustomerDetail | null>);
  private customerSvc = inject(CustomerService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected saving = signal(false);
  protected error = signal('');
  protected showOrdersLink = signal(false);

  protected submit() {
    this.saving.set(true);
    this.error.set('');
    this.showOrdersLink.set(false);
    this.customerSvc.deactivate(this.data.customerId).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.toast.success('Cliente desactivado');
        this.ref.close(detail);
      },
      error: (err) => {
        this.saving.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(detalle || 'No pudimos desactivar al cliente.');
        this.showOrdersLink.set(err?.status === 409 && !!detalle?.includes('pedido'));
      },
    });
  }

  protected goToOrders() {
    this.router.navigate(['/pedidos'], {
      queryParams: {
        customerId: this.data.customerId,
        customerName: this.data.businessName,
        statusCode: 'OPEN',
      },
    });
    this.ref.close(null);
  }
}
