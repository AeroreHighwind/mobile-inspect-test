import eruda, { Tool } from 'eruda';

type RequestEntry = {
  id: string;
  type: 'fetch' | 'xhr';
  state: 'pending' | 'done';
  method: string;
  url: string;
  path: string;
  name: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string;
  responseBody: string;
  sizeBytes: number | null;
  duration: number | null;
  status: number | null;
  statusText: string;
  ok: boolean | null;
  isError: boolean;
  startTime: number;
  endTime: number | null;
};

type DetailTab = 'summary' | 'headers' | 'payload';

const STYLE_ID = 'tn-style-tag';
const MAX_ENTRIES = 500;

function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatSize(sizeBytes: number | null): string {
  if (sizeBytes == null || Number.isNaN(sizeBytes)) return '–';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getHeaderValue(headers: Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  return headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
}

function getBodySize(headers: Record<string, string> | undefined, body: string): number | null {
  const contentLength = getHeaderValue(headers, 'content-length');
  if (contentLength && /^\d+$/.test(contentLength.trim())) {
    return Number(contentLength);
  }
  if (body == null) return null;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(body).length;
  }
  return body.length;
}

function parseUrl(url: string) {
  try {
    const a = document.createElement('a');
    a.href = url;
    return {
      full: a.href,
      path: a.pathname + a.search,
      host: a.host,
      name: (a.pathname.split('/').pop() || a.host) + (a.search || ''),
    };
  } catch {
    return { full: url, path: url, host: '', name: url };
  }
}

function headersToObj(headers: any): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!headers) return obj;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value: string, key: string) => {
      obj[key] = value;
    });
    return obj;
  }
  if (typeof headers === 'string') {
    headers.trim().split(/[\r\n]+/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        if (key) obj[key] = value;
      }
    });
    return obj;
  }
  if (typeof headers === 'object') {
    if (Array.isArray(headers)) {
      headers.forEach((pair: [string, string]) => {
        obj[pair[0]] = pair[1];
      });
    } else if (typeof headers.forEach === 'function') {
      headers.forEach((value: string, key: string) => {
        obj[key] = value;
      });
    } else {
      Object.keys(headers).forEach((key) => {
        obj[key] = headers[key];
      });
    }
  }
  return obj;
}

function bodyToDisplayString(body: any): string {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value: any, key: string) => {
      if (typeof value === 'object' && value && value.name) {
        parts.push(`${key}: (binary file) ${value.name} [${value.size || 0} bytes]`);
      } else {
        parts.push(`${key}: ${value}`);
      }
    });
    return parts.join('\n');
  }
  try {
    if (typeof body === 'object') {
      return JSON.stringify(body, null, 2);
    }
    return String(body);
  } catch {
    return String(body);
  }
}

function toEntriesList(headers: Record<string, string>): Array<[string, string]> {
  return Object.entries(headers).filter(([, value]) => value != null && value !== '');
}

class TrueNetworkTool implements Tool {
  name = 'trueNetwork';
  private _$el: any;
  private _root: HTMLElement | null = null;
  private _entries: RequestEntry[] = [];
  private _interceptorsInstalled = false;
  private _selectedId: string | null = null;
  private _activeTab: DetailTab = 'summary';

  init($el: any) {
    this._$el = $el;
    this._injectStyle();
    this._renderShell();
    this._bindEvents();
    this._installInterceptors();
    this._renderList();
  }

  show() {
    return this._$el.show();
  }

  hide() {
    return this._$el.hide();
  }

  destroy() {
    const style = document.getElementById(STYLE_ID);
    if (style?.parentNode) {
      style.parentNode.removeChild(style);
    }
    this._$el.html('');
  }

  private _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tn-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; height: 100%; display: flex; flex-direction: column; color: inherit; background: rgba(0,0,0,.02); }
      .tn-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid rgba(128,128,128,.25); flex-wrap: wrap; }
      .tn-btn { border: 1px solid rgba(128,128,128,.35); background: transparent; color: inherit; border-radius: 4px; padding: 3px 7px; font-size: 11px; cursor: pointer; }
      .tn-btn:active { opacity: 0.9; }
      .tn-main { display: flex; flex: 1; min-height: 0; }
      .tn-list-pane { width: 100%; min-width: 260px; border-right: 1px solid rgba(128,128,128,.25); display: flex; flex-direction: column; }
      .tn-list-header, .tn-row { display: grid; grid-template-columns: minmax(0, 2.2fr) 52px 64px 64px 64px 60px; gap: 8px; align-items: center; }
      .tn-list-header { padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: 0.7; border-bottom: 1px solid rgba(128,128,128,.2); }
      .tn-list { flex: 1; overflow: auto; padding: 4px; }
      .tn-row { padding: 7px 8px; border-radius: 4px; border-bottom: 1px solid rgba(128,128,128,.12); cursor: pointer; min-height: 38px; }
      .tn-row:hover { background: rgba(64, 120, 242, 0.12); }
      .tn-row.selected { background: rgba(64, 120, 242, 0.22); }
      .tn-cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tn-col-name { display: flex; flex-direction: column; gap: 2px; }
      .tn-name-main { font-weight: 600; }
      .tn-name-sub { opacity: 0.65; font-size: 10px; }
      .tn-col-method { font-weight: 600; }
      .tn-col-status { font-weight: 600; }
      .tn-pill { display: inline-block; padding: 1px 5px; border-radius: 999px; font-size: 10px; line-height: 1.4; background: rgba(128,128,128,.15); }
      .tn-pill-2xx { background: rgba(46,125,50,.18); color: #2e7d32; }
      .tn-pill-4xx { background: rgba(211,47,47,.16); color: #d32f2f; }
      .tn-pill-error { background: rgba(211,47,47,.16); color: #d32f2f; }
      .tn-col-type, .tn-col-size, .tn-col-time { opacity: 0.8; font-size: 11px; }
      .tn-detail-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .tn-detail-toolbar { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid rgba(128,128,128,.2); }
      .tn-tab { border: 1px solid rgba(128,128,128,.25); background: transparent; color: inherit; border-radius: 4px; padding: 3px 7px; font-size: 11px; cursor: pointer; }
      .tn-tab.active { background: rgba(64, 120, 242, 0.2); border-color: rgba(64, 120, 242, 0.6); }
      .tn-detail-body { flex: 1; overflow: auto; padding: 8px; }
      .tn-empty { padding: 16px 8px; opacity: 0.6; }
      .tn-card { border: 1px solid rgba(128,128,128,.17); border-radius: 6px; padding: 8px; margin-bottom: 8px; background: rgba(255,255,255,.03); }
      .tn-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: 0.7; margin-bottom: 6px; }
      .tn-grid { display: grid; grid-template-columns: minmax(90px, max-content) 1fr; gap: 4px 10px; font-size: 11px; }
      .tn-grid .tn-label { opacity: 0.72; }
      .tn-url { font-size: 11px; word-break: break-all; font-family: ui-monospace, SFMono-Regular, monospace; }
      .tn-pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; }
      .tn-kv { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 4px 10px; align-items: start; font-size: 11px; padding: 2px 0; border-bottom: 1px dashed rgba(128,128,128,.16); }
      .tn-kv:last-child { border-bottom: 0; }
      .tn-kv .tn-label { opacity: 0.72; }
      .tn-status-2xx { color: #2e7d32; }
      .tn-status-4xx { color: #d32f2f; }
      .tn-status-error { color: #d32f2f; }
    `;
    document.head.appendChild(style);
    eruda.util.evalCss(style.textContent)
  }

  private _renderShell() {
    this._$el.html(`
      <div class="tn-container">
        <div class="tn-toolbar">
          <button class="tn-btn tn-clear">Clear</button>
          <span class="tn-count">0 requests</span>
        </div>
        <div class="tn-main">
          <div class="tn-list-pane">
            <div class="tn-list-header">
              <div class="tn-cell tn-col-name">Name</div>
              <div class="tn-cell tn-col-method">Method</div>
              <div class="tn-cell tn-col-status">Status</div>
              <div class="tn-cell tn-col-type">Type</div>
              <div class="tn-cell tn-col-size">Size</div>
              <div class="tn-cell tn-col-time">Time</div>
            </div>
            <div class="tn-list"></div>
          </div>
          <div class="tn-detail-pane">
            <div class="tn-detail-toolbar">
              <button class="tn-tab tn-tab-summary active" data-tab="summary">Summary</button>
              <button class="tn-tab tn-tab-headers" data-tab="headers">Headers</button>
              <button class="tn-tab tn-tab-payload" data-tab="payload">Payload</button>
            </div>
            <div class="tn-detail-body"></div>
          </div>
        </div>
      </div>
    `);
    this._root = (this._$el[0] || this._$el) as HTMLElement;
  }

  private _bindEvents() {
    const root = this._root;
    if (!root) return;
    root.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement;
      const clearButton = target.closest('.tn-clear');
      const row = target.closest('.tn-row');
      const tab = target.closest('.tn-tab');

      if (clearButton) {
        this._entries = [];
        this._selectedId = null;
        this._renderList();
        return;
      }

      if (row instanceof HTMLElement) {
        const id = row.getAttribute('data-id');
        if (id) {
          this._selectedId = id;
          this._renderList();
        }
      }

      if (tab instanceof HTMLElement) {
        const nextTab = tab.getAttribute('data-tab') as DetailTab | null;
        if (nextTab) {
          this._activeTab = nextTab;
          this._renderDetail();
        }
      }
    });
  }

  private _installInterceptors() {
    if (this._interceptorsInstalled) return;
    this._interceptorsInstalled = true;
    this._installFetchInterceptor();
    this._installXhrInterceptor();
  }

  private _installFetchInterceptor() {
    if (typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch;

    window.fetch = function (this: any, input: any, init?: any) {
      const tool = this as TrueNetworkTool;
      const entry = tool._createEntry('fetch');
      let url = '';
      let method = 'GET';
      let headers: Record<string, string> = {};
      let body: any;

      if (typeof input === 'string') {
        url = input;
        method = (init?.method || 'GET').toUpperCase();
        headers = headersToObj(init?.headers);
        body = init?.body;
      } else if (input && typeof input === 'object') {
        url = input.url;
        method = (init?.method || input.method || 'GET').toUpperCase();
        headers = headersToObj(init?.headers || input.headers);
        body = init?.body ?? input.body;
      } else {
        url = String(input);
      }

      const urlInfo = parseUrl(url);
      entry.url = urlInfo.full;
      entry.path = urlInfo.path;
      entry.name = urlInfo.name;
      entry.method = method;
      entry.requestHeaders = headers;
      entry.requestBody = bodyToDisplayString(body);
      tool._pushEntry(entry);

      return originalFetch.call(window, input, init).then(
        (response: Response) => {
          entry.endTime = performance.now();
          entry.duration = entry.endTime - entry.startTime;
          entry.status = response.status;
          entry.statusText = response.statusText;
          entry.ok = response.ok;
          entry.responseHeaders = headersToObj((response as any).headers);
          entry.state = 'done';
          response.clone().text().then((text) => {
            entry.responseBody = text;
            entry.sizeBytes = getBodySize(entry.responseHeaders, text);
            tool._renderList();
          }).catch(() => {
            entry.responseBody = '';
            entry.sizeBytes = getBodySize(entry.responseHeaders, '');
            tool._renderList();
          });
          tool._renderList();
          return response;
        },
        (error: any) => {
          entry.endTime = performance.now();
          entry.duration = entry.endTime - entry.startTime;
          entry.status = 0;
          entry.statusText = 'Failed';
          entry.isError = true;
          entry.responseBody = error?.message || String(error);
          entry.state = 'done';
          tool._renderList();
          throw error;
        }
      );
    }.bind(this) as typeof window.fetch;
  }

  private _installXhrInterceptor() {
    if (typeof window.XMLHttpRequest !== 'function') return;
    const OrigXHR = window.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;
    const origSetHeader = OrigXHR.prototype.setRequestHeader;

    OrigXHR.prototype.open = function (method: string, url: string) {
      (this as any).__tn = {
        method: (method || 'GET').toUpperCase(),
        url,
        headers: {},
      };
      return origOpen.apply(this, arguments as any);
    };

    OrigXHR.prototype.setRequestHeader = function (name: string, value: string) {
      if ((this as any).__tn) {
        (this as any).__tn.headers[name] = value;
      }
      return origSetHeader.apply(this, arguments as any);
    };

    OrigXHR.prototype.send = function (this: any, body: any) {
      const xhr = this as XMLHttpRequest & { __tn?: any };
      const ctx = xhr.__tn;
      if (!ctx) return origSend.apply(this, arguments as any);

      const tool = this as TrueNetworkTool;
      const entry = tool._createEntry('xhr');
      const urlInfo = parseUrl(ctx.url);
      entry.url = urlInfo.full;
      entry.path = urlInfo.path;
      entry.name = urlInfo.name;
      entry.method = ctx.method;
      entry.requestHeaders = ctx.headers;
      entry.requestBody = bodyToDisplayString(body);
      tool._pushEntry(entry);

      const finalize = (isError: boolean) => {
        entry.endTime = performance.now();
        entry.duration = entry.endTime - entry.startTime;
        entry.status = xhr.status;
        entry.statusText = xhr.statusText;
        entry.ok = xhr.status >= 200 && xhr.status < 300;
        entry.isError = isError || xhr.status === 0;
        try {
          entry.responseHeaders = headersToObj(xhr.getAllResponseHeaders());
        } catch {
          entry.responseHeaders = {};
        }
        try {
          entry.responseBody = xhr.responseText || '';
          entry.sizeBytes = getBodySize(entry.responseHeaders, entry.responseBody);
        } catch {
          entry.responseBody = '';
          entry.sizeBytes = getBodySize(entry.responseHeaders, '');
        }
        entry.state = 'done';
        tool._renderList();
      };

      xhr.addEventListener('load', () => finalize(false));
      xhr.addEventListener('error', () => finalize(true));
      xhr.addEventListener('abort', () => finalize(true));
      xhr.addEventListener('timeout', () => finalize(true));

      return origSend.apply(xhr, arguments as any);
    }.bind(this);
  }

  private _createEntry(type: 'fetch' | 'xhr'): RequestEntry {
    return {
      id: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      state: 'pending',
      method: 'GET',
      url: '',
      path: '',
      name: '',
      requestHeaders: {},
      responseHeaders: {},
      requestBody: '',
      responseBody: '',
      sizeBytes: null,
      duration: null,
      status: null,
      statusText: '',
      ok: null,
      isError: false,
      startTime: performance.now(),
      endTime: null,
    };
  }

  private _pushEntry(entry: RequestEntry) {
    this._entries.push(entry);
    if (this._entries.length > MAX_ENTRIES) {
      this._entries.shift();
    }
    if (!this._selectedId) {
      this._selectedId = entry.id;
    }
    this._renderList();
  }

  private _renderList() {
    const list = this._root?.querySelector('.tn-list') as HTMLElement | null;
    const count = this._root?.querySelector('.tn-count') as HTMLElement | null;
    if (!list || !count) return;

    count.textContent = `${this._entries.length} request${this._entries.length === 1 ? '' : 's'}`;

    if (!this._entries.length) {
      list.innerHTML = '<div class="tn-empty">No requests captured yet.</div>';
      this._renderDetail();
      return;
    }

    if (!this._selectedId || !this._entries.some((entry) => entry.id === this._selectedId)) {
      this._selectedId = this._entries[this._entries.length - 1].id;
    }

    const rows = this._entries.slice().reverse().map((entry) => {
      const statusClass = entry.isError ? 'tn-status-error' : entry.status && entry.status >= 400 ? 'tn-status-4xx' : entry.status && entry.status >= 200 && entry.status < 300 ? 'tn-status-2xx' : '';
      const selectedClass = entry.id === this._selectedId ? 'selected' : '';
      const statusLabel = entry.state === 'pending' ? '…' : entry.isError ? 'ERR' : entry.status ?? '-';
      const statusPill = entry.state === 'pending' ? '' : `tn-pill ${entry.isError ? 'tn-pill-error' : entry.status && entry.status >= 400 ? 'tn-pill-4xx' : entry.status && entry.status >= 200 && entry.status < 300 ? 'tn-pill-2xx' : ''}`;
      return `
        <div class="tn-row ${selectedClass}" data-id="${escapeHtml(entry.id)}">
          <div class="tn-cell tn-col-name" title="${escapeHtml(entry.url)}">
            <div class="tn-name-main">${escapeHtml(entry.name || entry.path || entry.url)}</div>
            <div class="tn-name-sub">${escapeHtml(entry.path || entry.url)}</div>
          </div>
          <div class="tn-cell tn-col-method">${escapeHtml(entry.method)}</div>
          <div class="tn-cell tn-col-status"><span class="${statusPill}">${escapeHtml(statusLabel)}</span></div>
          <div class="tn-cell tn-col-type">${escapeHtml(entry.type.toUpperCase())}</div>
          <div class="tn-cell tn-col-size">${escapeHtml(formatSize(entry.sizeBytes))}</div>
          <div class="tn-cell tn-col-time">${escapeHtml(entry.state === 'pending' ? '…' : formatMs(entry.duration))}</div>
        </div>
      `;
    });

    list.innerHTML = rows.join('');
    this._renderDetail();
  }

  private _renderDetail() {
    const detail = this._root?.querySelector('.tn-detail-body') as HTMLElement | null;
    const tabs = this._root?.querySelectorAll('.tn-tab') as NodeListOf<HTMLElement> | null;

    if (!detail) return;

    if (tabs) {
      tabs.forEach((tab) => {
        const isActive = tab.getAttribute('data-tab') === this._activeTab;
        tab.classList.toggle('active', isActive);
      });
    }

    const selected = this._entries.find((entry) => entry.id === this._selectedId);
    if (!selected) {
      detail.innerHTML = '<div class="tn-empty">Select a request to inspect headers and payload.</div>';
      return;
    }

    if (this._activeTab === 'headers') {
      detail.innerHTML = `
        <div class="tn-card">
          <div class="tn-card-title">Request headers</div>
          ${this._renderHeaderList(selected.requestHeaders)}
        </div>
        <div class="tn-card">
          <div class="tn-card-title">Response headers</div>
          ${this._renderHeaderList(selected.responseHeaders)}
        </div>
      `;
      return;
    }

    if (this._activeTab === 'payload') {
      detail.innerHTML = `
        <div class="tn-card">
          <div class="tn-card-title">Request payload</div>
          ${selected.requestBody ? `<pre class="tn-pre">${escapeHtml(selected.requestBody)}</pre>` : '<div class="tn-empty">No request body captured.</div>'}
        </div>
        <div class="tn-card">
          <div class="tn-card-title">Response payload</div>
          ${selected.responseBody ? `<pre class="tn-pre">${escapeHtml(selected.responseBody)}</pre>` : '<div class="tn-empty">No response body captured yet.</div>'}
        </div>
      `;
      return;
    }

    detail.innerHTML = `
      <div class="tn-card">
        <div class="tn-card-title">Overview</div>
        <div class="tn-grid">
          <div class="tn-label">Method</div><div>${escapeHtml(selected.method)}</div>
          <div class="tn-label">Status</div><div class="${selected.isError ? 'tn-status-error' : selected.status && selected.status >= 400 ? 'tn-status-4xx' : selected.status && selected.status >= 200 && selected.status < 300 ? 'tn-status-2xx' : ''}">${escapeHtml(selected.state === 'pending' ? 'Pending' : selected.isError ? 'ERR' : selected.status ? `${selected.status} ${selected.statusText}` : '–')}</div>
          <div class="tn-label">Type</div><div>${escapeHtml(selected.type.toUpperCase())}</div>
          <div class="tn-label">Duration</div><div>${escapeHtml(formatMs(selected.duration))}</div>
          <div class="tn-label">URL</div><div class="tn-url">${escapeHtml(selected.url)}</div>
        </div>
      </div>
      <div class="tn-card">
        <div class="tn-card-title">Request details</div>
        <div class="tn-grid">
          <div class="tn-label">Name</div><div>${escapeHtml(selected.name || selected.path || selected.url)}</div>
          <div class="tn-label">Path</div><div>${escapeHtml(selected.path)}</div>
          <div class="tn-label">Request body</div><div>${escapeHtml(selected.requestBody ? 'Captured' : 'None')}</div>
          <div class="tn-label">Response body</div><div>${escapeHtml(selected.responseBody ? 'Captured' : 'None')}</div>
        </div>
      </div>
    `;
  }

  private _renderHeaderList(headers: Record<string, string>): string {
    const entries = toEntriesList(headers);
    if (!entries.length) {
      return '<div class="tn-empty">No headers captured.</div>';
    }

    return entries
      .map(([key, value]) => `
        <div class="tn-kv">
          <div class="tn-label">${escapeHtml(key)}</div>
          <div>${escapeHtml(value)}</div>
        </div>
      `)
      .join('');
  }
}

export function createTrueNetworkPlugin() {
  return new TrueNetworkTool();
}

const trueNetworkPlugin = createTrueNetworkPlugin();

export default trueNetworkPlugin;
