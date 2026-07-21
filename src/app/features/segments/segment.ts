import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CreateSegmentCommand, Segment, SegmentMember } from '../../shared/models/segment.models';

@Injectable({ providedIn: 'root' })
export class SegmentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/segments`;

  list() {
    return this.http.get<Segment[]>(this.base);
  }
  create(cmd: CreateSegmentCommand) {
    return this.http.post<Segment>(this.base, cmd);
  }
  members(id: number) {
    return this.http.get<SegmentMember[]>(`${this.base}/${id}/members`);
  }
  addMember(id: number, customerId: number) {
    return this.http.post<void>(`${this.base}/${id}/members/${customerId}`, {});
  }
  removeMember(id: number, customerId: number) {
    return this.http.delete<void>(`${this.base}/${id}/members/${customerId}`);
  }
}
