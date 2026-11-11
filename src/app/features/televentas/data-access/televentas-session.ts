import { Injectable, inject, signal } from '@angular/core';
import { UserSelfService } from '../../users/user-self';
import { CatalogLookupService } from '../../catalog/catalog-lookup';
import { PaymentConditionView } from '../../../shared/models/catalog.models';

/**
 * Lo que se pide una sola vez al entrar en modo televentas (doc 42, sección
 * 4.1): el almacén de la sede del vendedor (de ahí sale el stock que
 * muestra y descuenta Nuevo pedido) y las condiciones de pago.
 */
@Injectable({ providedIn: 'root' })
export class TelesalesSessionService {
  private userSelf = inject(UserSelfService);
  private catalogSvc = inject(CatalogLookupService);

  readonly loading = signal(true);
  readonly warehouseId = signal<number | null>(null);
  readonly noBranch = signal(false);
  readonly noWarehouse = signal(false);
  readonly paymentConditions = signal<PaymentConditionView[]>([]);

  private loaded = false;

  ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;

    this.catalogSvc.paymentConditions().subscribe((list) => this.paymentConditions.set(list));

    this.userSelf.me().subscribe({
      next: (user) => {
        if (!user.homeBranchId) {
          this.noBranch.set(true);
          this.loading.set(false);
          return;
        }
        this.catalogSvc.warehouses().subscribe({
          next: (list) => {
            const wh = list.find((w) => w.branchId === user.homeBranchId);
            if (!wh) {
              this.noWarehouse.set(true);
              this.loading.set(false);
              return;
            }
            this.warehouseId.set(wh.warehouseId);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
