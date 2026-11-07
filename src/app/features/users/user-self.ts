import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ChangePasswordCommand,
  UpdateProfileCommand,
  UserView,
} from '../../shared/models/user.models';

/**
 * UserController, /api/users — autoservicio (cualquier autenticado, opera
 * sobre sí mismo). El cambio de contraseña tiene el límite de negocio de
 * 1 vez al mes; si se llama antes, el backend responde error de negocio con
 * la fecha desde la que se puede reintentar — no se valida en frontend
 * porque el panel no sabe cuándo fue el último cambio.
 *
 * `profile` guarda el último `/me` pedido, para que el chip de la barra
 * superior (iniciales de firstName/lastName) y Mi perfil compartan un solo
 * pedido en vez de cada uno llamar por su cuenta (doc 38, sección 9, punto 6).
 */
@Injectable({ providedIn: 'root' })
export class UserSelfService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  readonly profile = signal<UserView | null>(null);

  me() {
    return this.http.get<UserView>(`${this.base}/me`);
  }

  /** Pide `/me` y actualiza `profile`; lo usan el shell (al abrir sesión) y Mi perfil. */
  refresh() {
    this.me().subscribe({
      next: (u) => this.profile.set(u),
      error: () => undefined,
    });
  }

  updateProfile(cmd: UpdateProfileCommand) {
    return this.http.patch<void>(`${this.base}/me`, cmd);
  }

  changePassword(cmd: ChangePasswordCommand) {
    return this.http.post<void>(`${this.base}/me/change-password`, cmd);
  }
}
