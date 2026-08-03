import { Component, inject, signal } from '@angular/core';
import { ErudaTestComponent } from '../modules/eruda/eruda-test/eruda-test';
import { ThemeService } from '../modules/utils/services/theme';

@Component({
  selector: 'app-root',
  imports: [ErudaTestComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('mobile-app');
  private readonly _themeService = inject(ThemeService);
  
  public toggleTheme() {
    this._themeService.toggle()
  }

  getTheme() {
    return this._themeService.theme();
  }

}
