import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hds.theme';

/**
 * Controla el modo claro/oscuro de la app.
 *  - 'system' (por defecto): sigue la preferencia del sistema operativo.
 *  - 'light' / 'dark': forzado por el usuario.
 *
 * Aplica la clase `theme-light` / `theme-dark` en <html>, que en _material.scss
 * fija `color-scheme` y hace que todos los tokens light-dark() cambien.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Modo elegido por el usuario ('system' | 'light' | 'dark'). */
  readonly mode = signal<ThemeMode>(this.read());

  constructor() {
    // Aplica la clase cada vez que cambia el modo.
    effect(() => this.apply(this.mode()));

    // Si está en 'system', reacciona cuando el SO cambia de tema.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.mode() === 'system') this.apply('system');
    });
  }

  /** Cambia el modo y lo persiste. */
  set(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  /** Alterna claro ↔ oscuro (útil para un botón simple). */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  /** Modo efectivo que se ve en pantalla (resuelve 'system'). */
  resolved(): ThemeMode {
    if (this.mode() === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.mode();
  }

  private apply(mode: ThemeMode): void {
    const el = document.documentElement;
    el.classList.remove('theme-light', 'theme-dark');
    if (mode === 'light') el.classList.add('theme-light');
    else if (mode === 'dark') el.classList.add('theme-dark');
    // 'system' → sin clase → color-scheme: light dark → sigue al SO
  }

  private read(): ThemeMode {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system';
  }
}
