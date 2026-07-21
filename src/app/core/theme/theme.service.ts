import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hds.theme';

/**
 * Modo claro/oscuro. 'system' sigue al SO; 'light'/'dark' lo fuerzan.
 * Aplica la clase theme-light/theme-dark en <html> (ver _material.scss).
 * (Ya te lo entregué con el tema; se incluye aquí para que el shell resuelva.)
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.read());

  constructor() {
    effect(() => this.apply(this.mode()));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.mode() === 'system') this.apply('system');
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

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
  }

  private read(): ThemeMode {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system';
  }
}
