import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// eruda gives you an on-device DevTools console (useful for debugging on a real phone).
// Remove this block (or guard it behind an environment flag) before shipping to production.
import eruda from 'eruda';
eruda.init();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
