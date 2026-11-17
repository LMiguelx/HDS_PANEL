import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  DeclarePickingItemsCommand,
  PickingDetail,
  PickingListFilters,
  PickingSummary,
} from '../../shared/models/picking.models';

@Injectable({ providedIn: 'root' })
export class PickingAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/deliveries/picking`;

  list(filters: PickingListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<PickingSummary>>(this.base, { params });
  }

  detail(batchId: number) {
    return this.http.get<PickingDetail>(`${this.base}/${batchId}`);
  }

  /** Upsert por producto — solo las filas modificadas, mientras el picking esté abierto. */
  declareItems(batchId: number, cmd: DeclarePickingItemsCommand) {
    return this.http.put<PickingDetail>(`${this.base}/${batchId}/items`, cmd);
  }

  /** Exige que ningún producto quede PENDING. Sin body, responde 204. */
  confirm(batchId: number) {
    return this.http.post<void>(`${this.base}/${batchId}/confirm`, {});
  }
}
