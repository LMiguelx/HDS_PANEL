import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  /** `action` reemplaza el botón "Cerrar" por un enlace propio (ej. "Ver ficha"). */
  success(msg: string, action?: ToastAction) {
    this.open(msg, 'toast-success', action);
  }
  error(msg: string) {
    this.open(msg, 'toast-error');
  }
  info(msg: string) {
    this.open(msg, 'toast-info');
  }

  private open(msg: string, panelClass: string, action?: ToastAction) {
    const ref = this.snack.open(msg, action?.label ?? 'Cerrar', {
      duration: 4000,
      panelClass,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
    if (action) ref.onAction().subscribe(() => action.onClick());
  }
}
