/**
 * eruda-open-on-start.plugin.ts
 *
 * Adds a small settings tool to eruda's panel with a single checkbox:
 * "Open eruda automatically on start". The choice is persisted to
 * localStorage under STORAGE_KEY, and read on the NEXT eruda.init() to
 * decide whether to call eruda.show() automatically or leave eruda
 * collapsed to just the floating entry button.
 */

import { Tool } from "eruda";

const STORAGE_KEY = 'openOnStart';

export function getOpenOnStart(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function setOpenOnStart(value: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
}

/**
 * Call this right after eruda.init() (and after eruda.add(erudaOpenOnStart)
 * if you're also registering the toggle tool below). Decides whether to
 * show the panel automatically based on the stored preference.
 */
export function applyOpenOnStart(eruda: any): void {
  if (getOpenOnStart()) {
    eruda.show();
  }
  // else: leave eruda collapsed to just the entry button (default behaviour)
}

/**
 * The eruda tool itself - shows up as its own tab with a single checkbox.
 * Registered via eruda.add(erudaOpenOnStart), same pattern as your
 * existing eruda-angular-devtools plugin.
 */
class OpenOnStart implements Tool{
  name = 'openOnStart';
  private _$el: any;

  init($el: any) {
    this._$el = $el;
    this._render();
    this._bindEvent();
  }

  show() {return this._$el.show();}
  hide() {return this._$el.hide();}
  destroy() {
    this._$el.html('');
  }

  private _render() {
    const checked = getOpenOnStart() ? 'checked' : '';
    this._$el.html(`
      <div style="padding:10px;font-size:14px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="eruda-open-on-start-checkbox" ${checked} />
          Open eruda automatically on start
        </label>
        <p style="opacity:.6;margin-top:8px;">
          Takes effect on the next page load.
        </p>
      </div>
    `);
  }

  private _bindEvent() {
    const checkbox = this._$el.find('#eruda-open-on-start-checkbox').get(0);
    checkbox.addEventListener('change', (e: Event) => {
      setOpenOnStart((e.target as HTMLInputElement).checked);
    });
  }
}

const erudaOpenOnStart = new OpenOnStart();

export default erudaOpenOnStart;
