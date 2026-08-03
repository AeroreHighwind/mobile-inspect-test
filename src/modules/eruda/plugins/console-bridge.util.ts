/**
 * console-bridge.util.ts
 *
 * Global console -> eruda bridge.
 *
 * Problem it solves:
 *  - Eruda renders objects by walking their OWN ENUMERABLE properties.
 *    Types like Date, Map, Set, RegExp, Error have none (or unhelpful ones),
 *    so they show up as "{}" or blank in eruda's console panel.
 *  - We don't want to touch native console.log behaviour (desktop DevTools,
 *    live object inspection, etc.) at all.
 *  - We don't want every Angular microfrontend / component to have to import
 *    or inject anything.
 *
 * How it works:
 *  1. We capture references to the REAL native console methods once, before
 *     anything else can touch them.
 *  2. We replace window.console.log/info/warn/error/debug with a wrapper.
 *  3. The wrapper ALWAYS calls the native method first, with the ORIGINAL,
 *     untouched arguments -> desktop DevTools / native debugging is 100%
 *     unaffected, always.
 *  4. If eruda is active, the wrapper additionally pushes a SANITIZED COPY
 *     of the arguments directly into eruda's console tool via its public
 *     API (eruda.get('console').log(...)), bypassing eruda's own console
 *     monkey-patch entirely (which we disable via overrideConsole: false).
 *
 * This file has zero Angular / framework dependencies on purpose, so it can
 * live in a shared package and be initialised once from the single-spa
 * root-config, before any microfrontend bootstraps.
 */

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'table';

const METHODS: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug', 'table'];

// Captured once, at module load time -> the real, unpatched console.
const nativeConsole: Record<ConsoleMethod, (...args: any[]) => void> = METHODS.reduce(
  (acc, m) => {
    acc[m] = console[m] ? console[m].bind(console) : console.log.bind(console);
    return acc;
  },
  {} as Record<ConsoleMethod, (...args: any[]) => void>
);

// eruda's console tool instance (eruda.get('console')), bound lazily.
let erudaConsole: any = null;

let installed = false;

/**
 * Call this once, right after eruda.init(...), to let the bridge know
 * eruda is available and where to push sanitized entries.
 *
 * IMPORTANT: also disable eruda's own console override so it doesn't
 * double-patch window.console on top of us:
 *
 *   eruda.get('console').config.set('overrideConsole', false);
 */
export function bindEruda(erudaInstance: any): void {
  erudaConsole = erudaInstance.get('console');
}

export function unbindEruda(): void {
  erudaConsole = null;
}

/**
 * Recursively converts values that eruda can't render meaningfully into
 * plain, inspectable representations. Only ever used for the COPY sent to
 * eruda - never touches what native console receives.
 */
function sanitize(value: any, seen: WeakSet<object> = new WeakSet()): any {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 'Invalid Date' : `\u{1F4C5} ${value.toISOString()}`;
  }

  if (value instanceof Error) {
    return {
      __type: 'Error',
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Map) {
    const obj: Record<string, any> = { __type: 'Map', size: value.size };
    let i = 0;
    for (const [k, v] of value.entries()) {
      obj[`[${i++}] ${String(k)}`] = sanitize(v, seen);
    }
    return obj;
  }

  if (value instanceof Set) {
    return { __type: 'Set', size: value.size, values: Array.from(value.values()).map((v) => sanitize(v, seen)) };
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `\u0192 ${value.name || 'anonymous'}()`;
  }

  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, seen));
  }

  if (typeof value === 'object') {
    // Guards against circular refs and also handles plain objects, class
    // instances, and Angular/zone.js-wrapped objects the same way.
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      try {
        out[key] = sanitize(value[key], seen);
      } catch {
        out[key] = '[Unreadable]';
      }
    }
    return out;
  }

  // primitives (string, number, boolean, symbol) pass through untouched
  return value;
}

function buildPatchedMethod(method: ConsoleMethod) {
  return (...args: any[]) => {
    // 1. Native console - always the ORIGINAL args, untouched.
    nativeConsole[method](...args);

    // 2. eruda - a sanitized COPY, pushed directly, bypassing native console.
    if (erudaConsole) {
      try {
        erudaConsole[method](...args.map((a) => sanitize(a)));
      } catch (e) {
        erudaConsole.error('[console-bridge] failed to render a log entry:', String(e));
      }
    }
  };
}

/**
 * Installs the bridge on window.console. Safe to call even if eruda is
 * never bound - in that case it's a transparent passthrough to native
 * console with negligible overhead.
 *
 * Call this ONCE, as early as possible in the app lifecycle (single-spa
 * root-config entry point), before any microfrontend registers/mounts.
 */
export function installConsoleBridge(): void {
  if (installed) return;
  installed = true;
  METHODS.forEach((m) => {
    (console as any)[m] = buildPatchedMethod(m);
  });
}

/** Restores the true native console methods. Mostly useful for tests. */
export function uninstallConsoleBridge(): void {
  if (!installed) return;
  installed = false;
  METHODS.forEach((m) => {
    (console as any)[m] = nativeConsole[m];
  });
}
