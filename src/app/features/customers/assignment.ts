import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AssignmentView, CreateAssignmentCommand } from '../../shared/models/assignment.models';

@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/assignments`;

  create(cmd: CreateAssignmentCommand) {
    return this.http.post<AssignmentView>(this.base, cmd);
  }

  /** Cierra la vigencia (rotación de cartera). */
  end(id: number, lastDay: string) {
    return this.http.post<void>(`${this.base}/${id}/end`, { lastDay });
  }

  byUser(userId: number) {
    return this.http.get<AssignmentView[]>(`${this.base}/by-user/${userId}`);
  }
  byCustomer(customerId: number) {
    return this.http.get<AssignmentView[]>(`${this.base}/by-customer/${customerId}`);
  }
}
