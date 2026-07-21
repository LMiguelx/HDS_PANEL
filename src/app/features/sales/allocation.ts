import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AllocationView } from '../../shared/models/allocation.models';

@Injectable({ providedIn: 'root' })
export class AllocationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promo-allocations`;

  /** Dotaciones del usuario logueado (para regalar en el pedido). */
  my() {
    return this.http.get<AllocationView[]>(`${this.base}/my`);
  }
}
