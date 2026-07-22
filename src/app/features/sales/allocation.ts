import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AllocationView, CreateAllocationCommand } from '../../shared/models/allocation.models';

@Injectable({ providedIn: 'root' })
export class AllocationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promo-allocations`;

  /** Dotaciones del usuario logueado (para regalar en el pedido). */
  my() {
    return this.http.get<AllocationView[]>(`${this.base}/my`);
  }

  /** Dotaciones de un vendedor (supervisión). */
  byUser(userId: number) {
    return this.http.get<AllocationView[]>(`${this.base}/by-user/${userId}`);
  }

  /** Asigna una dotación a un vendedor (promo.allocate). */
  create(cmd: CreateAllocationCommand) {
    return this.http.post<AllocationView>(this.base, cmd);
  }
}
