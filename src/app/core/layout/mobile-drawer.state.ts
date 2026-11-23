import { Injectable, effect, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Estado del cajón móvil del menú lateral, compartido entre la barra
 * superior (botón hamburguesa), el lateral (aplica la clase `.open` y lo
 * cierra al navegar) y el shell (velo). Se encarga también de cerrarse
 * solo al pasar a escritorio, para que ninguno de los tres tenga que
 * repetir esa regla.
 */
@Injectable({ providedIn: 'root' })
export class MobileDrawerState {
  private breakpoints = inject(BreakpointObserver);

  readonly open = signal(false);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      if (!this.isHandset()) this.open.set(false);
    });
  }

  toggle() {
    this.open.update((v) => !v);
  }

  close() {
    if (this.isHandset()) this.open.set(false);
  }
}
