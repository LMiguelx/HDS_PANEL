import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Role } from '../../shared/models/auth.models';

/** Catálogo de roles (user.manage). Sin pantalla propia todavía — falta el alta/edición de usuarios. */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/roles`;

  list() {
    return this.http.get<Role[]>(this.base);
  }
}
