import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { installConsoleBridge, bindEruda } from './app/modules/eruda/plugins/console-bridge.util';
import erudaOpenOnStart, { applyOpenOnStart } from './app/modules/eruda/plugins/eruda-open-on-start.plugin';

declare global {
  interface Window {
    __erudaInitialized?: boolean;
  }
}

if (!environment.production) {
  // guard: prevents double-init if multiple microfrontends load this same
  // main.ts pattern - they all share the same window/eruda instance
  if (!window.__erudaInitialized) {
    window.__erudaInitialized = true;

    import('eruda').then(({ default: eruda }) => {
      eruda.init({
        
      });
      eruda.add(erudaOpenOnStart);      // registers the toggle tab in eruda's panel
      applyOpenOnStart(eruda)

      import('./app/modules/eruda/plugins/eruda-angular-devtools.plugin').then(({ default: erudaAngularDevtools }) => {
        eruda.add(erudaAngularDevtools);
      });

      import('./app/modules/eruda/plugins/true-network.plugin').then(({ default: networkPlugin }) => {
        eruda.add(networkPlugin);
      });

      // stop eruda from monkey-patching window.console itself - we take
      // over that job so native/desktop console stays 100% untouched
      eruda.get('console').config.set('overrideConsole', false);

      // bind eruda + install the sanitizing console bridge: Date, Error,
      // Map, Set etc. now render properly in eruda's console panel
      bindEruda(eruda);
      installConsoleBridge();
    });
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));