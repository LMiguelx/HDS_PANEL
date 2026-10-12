import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UserSelfService } from '../users/user-self';
import { InventoryAdminService } from '../inventory/inventory-admin';

/**
 * Resuelve una sola vez (al primer uso) el almacén de la sede del
 * supervisor — doc 30, sección 4.3: el stock que se muestra y se descuenta
 * en mostrador es el de ese almacén, sin importar la sede del vendedor al
 * que se le dé la venta.
 */
@Injectable({ providedIn: 'root' })
export class CounterSessionStore {
  private userSvc = inject(UserSelfService);
  private inventorySvc = inject(InventoryAdminService);

  readonly loading = signal(true);
  readonly warehouseId = signal<number | null>(null);
  readonly warehouseName = signal<string | null>(null);
  /** true cuando el usuario no tiene sede — no se puede vender en mostrador. */
  readonly noBranch = signal(false);
  private loaded = false;

  ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    this.loading.set(true);
    forkJoin({ me: this.userSvc.me(), warehouses: this.inventorySvc.warehouses() }).subscribe({
      next: ({ me, warehouses }) => {
        if (me.homeBranchId == null) {
          this.noBranch.set(true);
          this.loading.set(false);
          return;
        }
        const warehouse = warehouses.find((w) => w.branchId === me.homeBranchId);
        this.warehouseId.set(warehouse?.warehouseId ?? null);
        this.warehouseName.set(warehouse?.name ?? null);
        this.noBranch.set(!warehouse);
        this.loading.set(false);
      },
      error: () => {
        this.noBranch.set(true);
        this.loading.set(false);
      },
    });
  }
}
