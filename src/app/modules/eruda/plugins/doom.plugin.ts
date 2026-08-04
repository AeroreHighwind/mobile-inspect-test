/**
 * eruda-doom.plugin.ts
 *
 * Adds a "doom" tool to eruda's panel: a canvas running DOOM via the
 * `wasm-doom` package, plus a Start button and an on-screen D-pad for
 * touch input. The engine only loads on first tap of "Start" (WebAudio
 * autoplay policies require a user gesture, and this avoids paying the
 * WASM load cost for people who never open the tab).
 *
 * Registered via eruda.add(erudaDoom), same pattern as your existing
 * eruda-angular-devtools / eruda-open-on-start plugins.
 */

import { Tool } from "eruda";
import { DOOM } from "wasm-doom";

// wasm-doom's onFrameRender always hands back a frame buffer sized to its
// internal, hardcoded native resolution (640x400) -- the screenWidth /
// screenHeight constructor options only affect the separate, per-pixel
// onPixelRender callback, NOT the onFrameRender buffer. The canvas backing
// size must match this exactly or `new ImageData(...)` throws
// IndexSizeError. CSS below handles the actual on-screen display size.
const DOOM_NATIVE_WIDTH = 640;
const DOOM_NATIVE_HEIGHT = 400;

// wasm-doom's internal keyboard handler reads the legacy `event.keyCode`
// numeric property (not `key`/`code`), so the D-pad must fake that exact
// value. These match the standard legacy keyCodes for the corresponding
// physical keys.
const DPAD_KEYS = {
  up: 38, // ArrowUp
  down: 40, // ArrowDown
  left: 37, // ArrowLeft
  right: 39, // ArrowRight
  fire: 17, // Control
  enter: 13, // Enter -- advances title/intro screens, confirms menu items
} as const;

/**
 * The eruda tool itself - shows up as its own tab with a canvas, a Start
 * button, and a touch D-pad. Registered via eruda.add(erudaDoom).
 */
class DoomTool implements Tool {
  name = "doom";

  private _$el: any;
  private _canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _statusEl!: HTMLElement;
  private _doom: DOOM | null = null;
  private _started = false;

  init($el: any) {
    this._$el = $el;
    this._render();
    this._bindEvents();
  }

  show() {
    return this._$el.show();
  }

  hide() {
    return this._$el.hide();
  }

  destroy() {
    this._doom = null; // wasm-doom exposes no teardown hook; drop the ref
    this._$el.html("");
  }

  private _render() {
    this._$el.html(`
      <div style="padding:10px;font-size:14px;max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <button id="eruda-doom-start">▶ Start DOOM</button>
          <span id="eruda-doom-status" style="opacity:.6;">idle</span>
        </div>
        <canvas
          id="eruda-doom-canvas"
          width="${DOOM_NATIVE_WIDTH}"
          height="${DOOM_NATIVE_HEIGHT}"
          tabindex="0"
          style="width:100%;max-width:320px;height:auto;image-rendering:pixelated;background:#000;display:block;margin:0 auto;outline:none;"
        ></canvas>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:8px;">
          <button data-key="up" style="touch-action:none;">↑</button>
          <div style="display:flex;gap:24px;">
            <button data-key="left" style="touch-action:none;">←</button>
            <button data-key="fire" style="touch-action:none;">FIRE</button>
            <button data-key="right" style="touch-action:none;">→</button>
          </div>
          <button data-key="down" style="touch-action:none;">↓</button>
          <button data-key="enter" style="touch-action:none;margin-top:6px;">ENTER</button>
        </div>
        <p style="opacity:.6;margin-top:8px;">
          Tap Start, then use the pad or a keyboard.
        </p>
      </div>
    `);

    this._canvas = this._$el.find("#eruda-doom-canvas").get(0);
    this._ctx = this._canvas.getContext("2d");
    this._statusEl = this._$el.find("#eruda-doom-status").get(0);
  }

  private _bindEvents() {
    this._$el.find("#eruda-doom-start").on("click", () => this._start());

    // Bound natively (not through the $-wrapper) with an explicit
    // { passive: false } so preventDefault() reliably suppresses the
    // panel's own scroll/gesture handling. Pointer Events unify mouse
    // and touch, avoiding duplicate firing from mixing touchstart with
    // synthetic mousedown compat events.
    const root: HTMLElement = this._$el.get(0);
    const padButtons =
      root.querySelectorAll<HTMLElement>("[data-key]");

    padButtons.forEach((btn) => {
      const key = this._keyFor(btn);

      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        this._canvas.focus(); // taps steal focus onto the button otherwise,
        // which would break the next physical keypress
        this._dispatchKey(key, "keydown");
      };

      const onUp = (e: PointerEvent) => {
        e.preventDefault();
        this._dispatchKey(key, "keyup");
      };

      btn.addEventListener("pointerdown", onDown, { passive: false });
      btn.addEventListener("pointerup", onUp, { passive: false });
      // Fires if a touch drags off the button or the OS interrupts the
      // gesture (e.g. an incoming notification) -- without this the key
      // can get stuck "held" with no matching keyup ever sent.
      btn.addEventListener("pointercancel", onUp, { passive: false });
      btn.addEventListener("pointerleave", onUp, { passive: false });
    });
  }

  private _keyFor(el: HTMLElement): number {
    const dir = el.dataset["key"] as keyof typeof DPAD_KEYS;
    return DPAD_KEYS[dir];
  }

  private async _start() {
    if (this._started) return;
    this._started = true;
    this._statusEl.textContent = "loading…";

    this._doom = new DOOM({
      // Only consumed by onPixelRender internally; harmless to leave at
      // native size since we're using onFrameRender instead (much faster
      // than the per-pixel callback).
      screenWidth: DOOM_NATIVE_WIDTH,
      screenHeight: DOOM_NATIVE_HEIGHT,
      keyboardTarget: this._canvas, // scope input to the panel, not window
      enableLogs: false,
      onFrameRender: ({ screen }) => {
        const frame = new ImageData(
          screen,
          DOOM_NATIVE_WIDTH,
          DOOM_NATIVE_HEIGHT
        );
        this._ctx.putImageData(frame, 0, 0);
      },
    });

    try {
      await this._doom.start();
      this._statusEl.textContent = "running";
      this._canvas.focus();
    } catch (err) {
      this._statusEl.textContent = "failed to load (see console)";
      console.error("[eruda-doom] failed to start:", err);
    }
  }

  private _dispatchKey(keyCode: number, type: "keydown" | "keyup") {
    if (!keyCode || !this._canvas) return;
    const event = new KeyboardEvent(type, { bubbles: true });
    // `keyCode` is a legacy getter that browsers only populate for real,
    // trusted key presses -- it's not settable via the KeyboardEventInit
    // dictionary. wasm-doom reads event.keyCode directly, so we shadow
    // the prototype getter on this instance to fake it.
    Object.defineProperty(event, "keyCode", { get: () => keyCode });
    this._canvas.dispatchEvent(event);
  }
}

const erudaDoom = new DoomTool();

export default erudaDoom;