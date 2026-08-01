import { Component, signal } from '@angular/core';
import { ErudaTestComponent } from './eruda-test/eruda-test';

@Component({
  selector: 'app-root',
  imports: [ErudaTestComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('mobile-app');
}
