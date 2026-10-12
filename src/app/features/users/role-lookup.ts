import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Role } from '../../shared/models/auth.models';

/** RoleController, /api/roles — catálogo de roles activos (`user.manage`). */
@Injectable({ providedIn: 'root' })
export class RoleLookupService {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }
}
