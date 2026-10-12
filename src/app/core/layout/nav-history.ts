import { Injectable, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Pila de navegación para los botones Atrás/Adelante de la barra superior.
 * Usa el historial real del navegador (`Location.back()/forward()`) en vez
 * de re-navegar por URL guardada, para que Electron/el navegador mantengan
 * su propio estado; la pila local solo sirve para saber si hay a dónde ir,
 * ya que el historial del navegador no expone esa posición.
 */
@Injectable({ providedIn: 'root' })
export class NavHistoryService {
  private router = inject(Router);
  private location = inject(Location);

  private stack: string[] = [];
  private index = -1;
  private skipNext = false;

  readonly canGoBack = signal(false);
  readonly canGoForward = signal(false);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      if (this.skipNext) {
        this.skipNext = false;
      } else {
        this.stack = this.stack.slice(0, this.index + 1);
        this.stack.push(url);
        this.index = this.stack.length - 1;
      }
      this.updateFlags();
    });
  }

  private updateFlags() {
    this.canGoBack.set(this.index > 0);
    this.canGoForward.set(this.index < this.stack.length - 1);
  }

  back() {
    if (this.index <= 0) return;
    this.index--;
    this.skipNext = true;
    this.location.back();
    this.updateFlags();
  }

  forward() {
    if (this.index >= this.stack.length - 1) return;
    this.index++;
    this.skipNext = true;
    this.location.forward();
    this.updateFlags();
  }
}
