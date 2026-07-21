import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  success(msg: string) {
    this.open(msg, 'toast-success');
  }
  error(msg: string) {
    this.open(msg, 'toast-error');
  }
  info(msg: string) {
    this.open(msg, 'toast-info');
  }

  private open(msg: string, panelClass: string) {
    this.snack.open(msg, 'Cerrar', {
      duration: 4000,
      panelClass,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
