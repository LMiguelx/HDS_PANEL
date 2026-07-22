import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreateMovementCommand,
  KardexResponse,
  WarehouseView,
} from '../../shared/models/inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/inventory`;

  kardex(productId: number, page = 0, size = 20) {
    return this.http.get<KardexResponse>(`${this.base}/kardex/${productId}`, {
      params: { page, size },
    });
  }
  warehouses() {
    return this.http.get<WarehouseView[]>(`${this.base}/warehouses`);
  }
  /** Solo ajustes manuales (MANUAL_ADJUSTMENT). config.edit. */
  createMovement(cmd: CreateMovementCommand) {
    return this.http.post<void>(`${this.base}/movements`, cmd);
  }
}
