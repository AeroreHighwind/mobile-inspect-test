import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Loading } from '../../common/loading/loading';

@Component({
  selector: 'app-eruda-test',
  standalone: true,
  imports: [CommonModule, Loading],
  templateUrl: './eruda-test.html',
  styleUrls: ['./eruda-test.scss'],
  
})
export class ErudaTestComponent {
  public showSetup = false;

  constructor() {
    this.fetchSuccess()
  }

  counter = 0;
  loading = false;

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
      { id: 1, name: 'Alice', role: 'Admin' },
      { id: 2, name: 'Bob', role: 'User' },
      { id: 3, name: 'Charlie', role: 'Guest' }
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
}