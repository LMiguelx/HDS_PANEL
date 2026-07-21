import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ClosureRequest,
  CreationRequest,
  FieldChangeRequest,
} from '../../shared/models/customer-request.models';

export type RequestType = 'creation' | 'field-change' | 'closure';

@Injectable({ providedIn: 'root' })
export class CustomerRequestService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/customer-requests`;

  pendingCreation() {
    return this.http.get<CreationRequest[]>(`${this.base}/creation/pending`);
  }
  pendingFieldChange() {
    return this.http.get<FieldChangeRequest[]>(`${this.base}/field-change/pending`);
  }
  pendingClosure() {
    return this.http.get<ClosureRequest[]>(`${this.base}/closure/pending`);
  }

  approve(type: RequestType, id: number) {
    return this.http.post<void>(`${this.base}/${type}/${id}/approve`, {});
  }
  reject(type: RequestType, id: number, reason: string) {
    return this.http.post<void>(`${this.base}/${type}/${id}/reject`, { reason });
  }
}
