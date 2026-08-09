import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Loading } from '../../common/loading/loading';
import { AndroidService } from '../../yorha/services/android-service';
import { Android } from '../../yorha/data/android-models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { ThemeService } from '../../utils/services/theme';

@Component({
  selector: 'app-eruda-test',
  standalone: true,
  imports: [CommonModule, Loading],
  providers: [TitleCasePipe],
  templateUrl: './eruda-test.html',
  styleUrls: ['./eruda-test.scss'],

})
export class ErudaTestComponent {
  private readonly _androidService = inject(AndroidService);
  private readonly _currentAndroid = signal<Android>(null);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _titleCase = inject(TitleCasePipe)
  private readonly _theme = inject(ThemeService).theme
  public showSetup = false;
  public counter = 0;
  public loading = false;

  log() {
    console.log('Hello from Angular!', new Date());
  }

  warn() {
    console.warn('This is a warning', new Date());
  }

  error() {
    console.error('This is an error', new Date());
  }

  table() {
    console.table([
      { id: 1, name: '1C', role: 'Commander' },
      { id: 2, name: '33O', role: 'Operator' },
      { id: 3, name: '51O', role: 'Operator' },
      { id: 4, name: '13G', role: 'Gunner' },
      { id: 5, name: '0B', role: 'Battler' },
    ]);
  }

  increment() {
    this.counter++;
    console.log('Counter:', this.counter);
  }

  saveStorage() {
    localStorage.setItem('eruda-test', JSON.stringify({
      counter: this.counter,
      timestamp: Date.now()
    }));

    console.log('Saved to localStorage');
  }

  loadStorage() {
    console.log(
      'Storage:',
      JSON.parse(localStorage.getItem('eruda-test') ?? '{}')
    );
  }

  async fetchSuccess() {
    this.loading = true;

    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const data = await res.json();

      console.log('Fetch success:', data);
    } finally {
      this.loading = false;
    }
  }

  async fetch404() {
    try {
      await fetch('https://jsonplaceholder.typicode.com/does-not-exist');
    } catch (e) {
      console.error(e);
    }
  }

  async fetchNetworkError() {
    try {
      await fetch('https://invalid-domain-123456789.test');
    } catch (e) {
      console.error('Network error:', e);
    }
  }

  promiseReject() {
    Promise.reject(new Error('Dummy rejected promise'));
  }

  throwException() {
    throw new Error('Dummy exception');
  }

  showOrHideSetup(value: boolean) {
    if (!value) this.getMVA();
    this.showSetup = value;
  }

  domChange() {
    const box = document.getElementById('box');

    if (box) {
      box.textContent = 'DOM updated!';
      box.style.background = '#4caf50';
      box.style.color = 'white';
      console.log('DOM modified');
    }
  }

  nextAndroid() {
    this._androidService.getNextAndroid().pipe(
      takeUntilDestroyed(this._destroyRef),
      tap((a) => this._currentAndroid.update(() => a))
    ).subscribe()
  }

  previousAndroid() {
    this._androidService.getPreviousAndroid().pipe(
      takeUntilDestroyed(this._destroyRef),
      tap((a) => this._currentAndroid.update(() => a))
    ).subscribe()
  }

  public getAndroidFullModel() {
    if (!this.selectedAndroid) return 'Android data unavailable'
    const android = this.selectedAndroid;
    const modelName = this._titleCase.transform(android.modelName);
    return `YoRHa ${modelName} Type Number ${android.modelNumber}`;
  }

  private getMVA() {
    this._androidService.getAndroidById(2).pipe(
      takeUntilDestroyed(this._destroyRef),
      tap((a) => this._currentAndroid.update(() => a))
    ).subscribe()
  }

  get selectedAndroid() {
    const computedAndroid = computed(() => this._currentAndroid())
    return computedAndroid();
  }

  get currentTheme() {
    const val = this._theme() as string;
    return val;
  }
}