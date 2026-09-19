import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ChangePasswordCommand, UpdateProfileCommand, UserView } from '../../shared/models/user.models';

/**
 * UserController, /api/users — autoservicio (cualquier autenticado, opera
 * sobre sí mismo). El cambio de contraseña tiene el límite de negocio de
 * 1 vez al mes; si se llama antes, el backend responde error de negocio con
 * la fecha desde la que se puede reintentar — no se valida en frontend
 * porque el panel no sabe cuándo fue el último cambio.
 */
@Injectable({ providedIn: 'root' })
export class UserSelfService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  me() {
    return this.http.get<UserView>(`${this.base}/me`);
  }

  updateProfile(cmd: UpdateProfileCommand) {
    return this.http.patch<void>(`${this.base}/me`, cmd);
  }

  changePassword(cmd: ChangePasswordCommand) {
    return this.http.post<void>(`${this.base}/me/change-password`, cmd);
  }
}
