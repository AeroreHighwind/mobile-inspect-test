// theme.service.ts
import { Injectable, signal } from '@angular/core';

export type YorhaTheme = 'theme-dark' | 'theme-light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<YorhaTheme>(
    (localStorage.getItem('yorha-theme') as YorhaTheme) || 'theme-dark'
  );

  constructor() {
    this.apply(this.theme());
  }

  toggle() {
    const next: YorhaTheme = this.theme() === 'theme-dark' ? 'theme-light' : 'theme-dark';
    this.theme.set(next);
    this.apply(next);
    localStorage.setItem('yorha-theme', next);
  }

  private apply(theme: YorhaTheme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme);
  }
}