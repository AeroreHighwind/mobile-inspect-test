// @ts-nocheck
/*!
 * eruda-angular-devtools
 * A lightweight "Angular DevTools" panel for Eruda.
 *
 * Lets you inspect the Angular component tree, view/edit component
 * properties, see event listeners, highlight elements on the page, and
 * trigger change detection — all from Eruda's mobile-friendly panel.
 *
 * Relies on Angular's public debugging globals (`window.ng`), which Ivy
 * exposes automatically unless the app explicitly disables them
 * (`enableProdMode()` no longer disables them by default since Angular 9,
 * but some prod builds strip them via `ngDevMode`/build optimizer).
 *
 * ESM usage (npm eruda package):
 *   import eruda from 'eruda';
 *   import erudaAngularDevtools from './eruda-angular-devtools';
 *
 *   if (!environment.production) {
 *     eruda.init();
 *     eruda.add(erudaAngularDevtools);
 *   }
 */

var win = typeof window !== 'undefined' ? window : self;
var doc = win.document;

/* ------------------------------------------------------------------ *
 * Small DOM helpers
 * ------------------------------------------------------------------ */

function h(tag, attrs, children) {
    var e = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      if (typeof c === 'string') e.appendChild(doc.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function safeStringify(value, depth) {
    depth = depth || 0;
    try {
      if (value === null) return 'null';
      var t = typeof value;
      if (t === 'undefined') return 'undefined';
      if (t === 'string') {
        return '"' + (value.length > 140 ? value.slice(0, 140) + '…' : value) + '"';
      }
      if (t === 'number' || t === 'boolean') return String(value);
      if (t === 'function') return 'ƒ ' + (value.name || 'anonymous') + '()';
      if (depth > 2) return Array.isArray(value) ? '[…]' : '{…}';
      if (value instanceof Node) {
        var tag = value.tagName ? value.tagName.toLowerCase() : 'node';
        var id = value.id ? '#' + value.id : '';
        return '<' + tag + id + '>';
      }
      if (Array.isArray(value)) {
        if (!value.length) return '[]';
        var items = value
          .slice(0, 10)
          .map(function (v) { return safeStringify(v, depth + 1); })
          .join(', ');
        return '[' + items + (value.length > 10 ? ', …' : '') + ']';
      }
      if (t === 'object') {
        var keys = Object.keys(value).filter(function (k) {
          return k.indexOf('__ngContext__') !== 0;
        });
        var shown = keys.slice(0, 15).map(function (k) {
          var v;
          try { v = value[k]; } catch (e) { v = '⚠'; }
          return k + ': ' + safeStringify(v, depth + 1);
        });
        return '{' + shown.join(', ') + (keys.length > 15 ? ', …' : '') + '}';
      }
      return String(value);
    } catch (e) {
      return '⚠ ' + e.message;
    }
  }

  function isPrimitive(v) {
    var t = typeof v;
    return v === null || t === 'string' || t === 'number' || t === 'boolean';
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ------------------------------------------------------------------ *
   * Style
   * ------------------------------------------------------------------ */

  var STYLE_ID = 'eruda-angular-devtools-style';
  var CSS = [
    '.eruda-ng { height: 100%; display: flex; flex-direction: column; font-size: 12px; color: #eee; }',
    '.eruda-ng * { box-sizing: border-box; }',
    '.eruda-ng-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px; border-bottom: 1px solid rgba(255,255,255,.1); flex-wrap: wrap; }',
    '.eruda-ng-toolbar input[type=text] { flex: 1; min-width: 90px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); color: #eee; border-radius: 4px; padding: 4px 6px; font-size: 12px; }',
    '.eruda-ng-btn { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); color: #eee; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; white-space: nowrap; }',
    '.eruda-ng-btn:active { background: rgba(255,255,255,.25); }',
    '.eruda-ng-btn.active { background: #dd0031; border-color: #dd0031; color: #fff; }',
    '.eruda-ng-status { padding: 4px 8px; font-size: 11px; opacity: .75; border-bottom: 1px solid rgba(255,255,255,.08); }',
    '.eruda-ng-status.warn { color: #ffb100; }',
    '.eruda-ng-body { flex: 1; display: flex; min-height: 0; }',
    '.eruda-ng-tree { flex: 1 1 55%; overflow: auto; padding: 4px 0; border-right: 1px solid rgba(255,255,255,.08); }',
    '.eruda-ng-detail { flex: 1 1 45%; overflow: auto; padding: 6px 8px; }',
    '.eruda-ng-node { list-style: none; margin: 0; padding-left: 14px; }',
    '.eruda-ng-node.eruda-ng-root { padding-left: 0; }',
    '.eruda-ng-row { display: flex; align-items: center; padding: 2px 4px; border-radius: 3px; cursor: pointer; white-space: nowrap; }',
    '.eruda-ng-row:hover { background: rgba(255,255,255,.08); }',
    '.eruda-ng-row.selected { background: rgba(221,0,49,.35); }',
    '.eruda-ng-row.dim { opacity: .3; }',
    '.eruda-ng-toggle { width: 12px; flex: none; text-align: center; opacity: .6; font-size: 9px; }',
    '.eruda-ng-tag { color: #dd0031; font-weight: bold; }',
    '.eruda-ng-hash { color: #7ab4ff; opacity: .8; margin-left: 4px; font-size: 10px; }',
    '.eruda-ng-section-title { font-weight: bold; margin: 8px 0 4px; opacity: .8; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }',
    '.eruda-ng-prop { display: flex; align-items: flex-start; gap: 4px; padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,.06); }',
    '.eruda-ng-prop-key { color: #9cdcfe; flex: none; min-width: 70px; word-break: break-all; }',
    '.eruda-ng-prop-val { flex: 1; word-break: break-all; color: #ce9178; }',
    '.eruda-ng-prop-val input { width: 100%; background: rgba(255,255,255,.08); border: 1px solid #dd0031; color: #eee; border-radius: 3px; padding: 1px 4px; font-size: 11px; }',
    '.eruda-ng-empty { padding: 16px 8px; opacity: .6; text-align: center; }',
    '.eruda-ng-hl-box { position: absolute; z-index: 2147483000; pointer-events: none; background: rgba(66,133,244,.25); border: 1px solid #4285f4; transition: all .05s ease-out; }',
    '.eruda-ng-hl-label { position: absolute; top: -18px; left: 0; background: #4285f4; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 2px; white-space: nowrap; }'
  ].join('\n');

  function injectStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    var style = h('style', { id: STYLE_ID });
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Page-overlay highlighter (used for hover / picker)
   * ------------------------------------------------------------------ */

  function Highlighter() {
    this.box = h('div', { class: 'eruda-ng-hl-box' });
    this.label = h('div', { class: 'eruda-ng-hl-label' });
    this.box.appendChild(this.label);
    this.box.style.display = 'none';
    doc.body.appendChild(this.box);
  }
  Highlighter.prototype.show = function (target, text) {
    if (!target || !target.getBoundingClientRect) return this.hide();
    var r = target.getBoundingClientRect();
    this.box.style.display = 'block';
    this.box.style.left = (r.left + win.scrollX) + 'px';
    this.box.style.top = (r.top + win.scrollY) + 'px';
    this.box.style.width = Math.max(r.width, 2) + 'px';
    this.box.style.height = Math.max(r.height, 2) + 'px';
    this.label.textContent = text || '';
  };
  Highlighter.prototype.hide = function () {
    this.box.style.display = 'none';
  };
  Highlighter.prototype.destroy = function () {
    if (this.box.parentNode) this.box.parentNode.removeChild(this.box);
  };

  /* ------------------------------------------------------------------ *
   * Angular introspection helpers (wrap window.ng.*)
   * ------------------------------------------------------------------ */

  function ngApi() {
    return win.ng || null;
  }

  function isAngularAvailable() {
    var ng = ngApi();
    return !!(ng && typeof ng.getComponent === 'function');
  }

  function angularVersion() {
    var withVersion = doc.querySelector('[ng-version]');
    return withVersion ? withVersion.getAttribute('ng-version') : null;
  }

  function componentName(instance) {
    var ng = ngApi();
    try {
      if (ng.getDirectiveMetadata) {
        var meta = ng.getDirectiveMetadata(instance);
        if (meta && meta.name) return meta.name;
      }
    } catch (e) { /* ignore */ }
    return (instance && instance.constructor && instance.constructor.name) || 'Unknown';
  }

  // Walk the real DOM (not Angular's internal view tree) looking for
  // elements that are component hosts, nesting tree nodes by DOM nesting.
  function buildTree() {
    var ng = ngApi();
    var roots = [];
    var elementToNode = new WeakMap();

    function walk(domNode, parentTreeNode) {
      if (domNode.nodeType !== 1) return; // elements only
      var current = parentTreeNode;
      var component = null;
      try { component = ng.getComponent(domNode); } catch (e) { /* not a host */ }

      if (component) {
        var treeNode = {
          name: componentName(component),
          element: domNode,
          component: component,
          children: []
        };
        if (parentTreeNode) parentTreeNode.children.push(treeNode);
        else roots.push(treeNode);
        elementToNode.set(domNode, treeNode);
        current = treeNode;
      }

      for (var i = 0; i < domNode.children.length; i++) {
        walk(domNode.children[i], current);
      }
    }

    if (doc.body) walk(doc.body, null);
    return { roots: roots, elementToNode: elementToNode };
  }

  function findNearestComponentElement(startEl) {
    var ng = ngApi();
    var e = startEl;
    while (e && e !== doc.documentElement.parentNode) {
      try { if (ng.getComponent(e)) return e; } catch (err) { /* ignore */ }
      e = e.parentElement;
    }
    return null;
  }

  function getListenersFor(element) {
    var ng = ngApi();
    if (!ng.getListeners) return [];
    try { return ng.getListeners(element) || []; } catch (e) { return []; }
  }

  function applyChangesFor(component) {
    var ng = ngApi();
    if (!ng.applyChanges) return false;
    try { ng.applyChanges(component); return true; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ *
   * Plugin
   * ------------------------------------------------------------------ */

  var plugin = {
    name: 'angular',

    init: function ($el) {
      injectStyle();
      this._$el = $el;
      this._container = $el.get ? $el.get(0) : $el[0] || $el;
      this._highlighter = new Highlighter();
      this._elementToNode = new WeakMap();
      this._roots = [];
      this._selected = null;
      this._search = '';
      this._picking = false;
      this._expanded = new WeakMap(); // element -> bool, default expanded

      this._onPickerMove = this._onPickerMove.bind(this);
      this._onPickerClick = this._onPickerClick.bind(this);

      this._renderShell();
      this.refresh();
    },

    show: function () {
      if (this._$el && this._$el.show) this._$el.show();
      else if (this._container) this._container.style.display = '';
      this.refresh();
      return this;
    },

    hide: function () {
      this._setPicking(false);
      this._highlighter.hide();
      if (this._$el && this._$el.hide) this._$el.hide();
      else if (this._container) this._container.style.display = 'none';
      return this;
    },

    destroy: function () {
      this._setPicking(false);
      this._highlighter.destroy();
      var style = doc.getElementById(STYLE_ID);
      if (style) style.parentNode.removeChild(style);
    },

    /* ---------------- rendering ---------------- */

    _renderShell: function () {
      var self = this;
      clear(this._container);

      var root = h('div', { class: 'eruda-ng' });

      var searchInput = h('input', {
        type: 'text',
        placeholder: 'Filter components…',
        oninput: debounce(function (e) {
          self._search = e.target.value.trim().toLowerCase();
          self._renderTree();
        }, 150)
      });

      var refreshBtn = h('button', {
        class: 'eruda-ng-btn',
        onclick: function () { self.refresh(); }
      }, ['⟳ Refresh']);

      var pickBtn = h('button', {
        class: 'eruda-ng-btn',
        onclick: function () { self._setPicking(!self._picking); }
      }, ['◎ Pick']);
      this._pickBtn = pickBtn;

      var toolbar = h('div', { class: 'eruda-ng-toolbar' }, [searchInput, pickBtn, refreshBtn]);

      this._status = h('div', { class: 'eruda-ng-status' }, ['Scanning…']);

      this._treeEl = h('div', { class: 'eruda-ng-tree' });
      this._detailEl = h('div', { class: 'eruda-ng-detail' }, [
        h('div', { class: 'eruda-ng-empty' }, ['Select a component to inspect it.'])
      ]);

      var body = h('div', { class: 'eruda-ng-body' }, [this._treeEl, this._detailEl]);

      root.appendChild(toolbar);
      root.appendChild(this._status);
      root.appendChild(body);
      this._container.appendChild(root);
    },

    refresh: function () {
      if (!isAngularAvailable()) {
        this._status.className = 'eruda-ng-status warn';
        this._status.textContent =
          'Angular debugging API (window.ng) not found. Make sure the page ' +
          'has an Angular app running with debugging tools enabled (default ' +
          'in dev builds; some production builds strip them).';
        clear(this._treeEl);
        return;
      }

      var built = buildTree();
      this._roots = built.roots;
      this._elementToNode = built.elementToNode;

      var version = angularVersion();
      this._status.className = 'eruda-ng-status';
      this._status.textContent =
        (version ? 'Angular ' + version : 'Angular detected') +
        ' — ' + this._countNodes(this._roots) + ' component(s) found.';

      // keep selection if the element is still in the tree
      if (this._selected && !this._elementToNode.has(this._selected.element)) {
        this._selected = null;
        this._renderDetail(null);
      }

      this._renderTree();
    },

    _countNodes: function (nodes) {
      var n = 0;
      nodes.forEach(function (node) {
        n += 1 + (node.children ? this._countNodesArr(node.children) : 0);
      }, this);
      return n;
    },
    _countNodesArr: function (nodes) {
      var self = this;
      return nodes.reduce(function (acc, node) {
        return acc + 1 + self._countNodesArr(node.children);
      }, 0);
    },

    _renderTree: function () {
      clear(this._treeEl);
      if (!this._roots.length) {
        this._treeEl.appendChild(h('div', { class: 'eruda-ng-empty' }, ['No components found.']));
        return;
      }
      var ul = h('ul', { class: 'eruda-ng-node eruda-ng-root' });
      this._roots.forEach(function (node) {
        ul.appendChild(this._renderNode(node));
      }, this);
      this._treeEl.appendChild(ul);
    },

    _matchesSearch: function (node) {
      if (!this._search) return true;
      if (node.name.toLowerCase().indexOf(this._search) !== -1) return true;
      return node.children.some(this._matchesSearch, this);
    },

    _renderNode: function (node) {
      var self = this;
      var matches = this._matchesSearch(node);
      var li = h('li');
      var expanded = this._expanded.has(node.element) ? this._expanded.get(node.element) : true;

      var toggle = h('span', { class: 'eruda-ng-toggle' }, [
        node.children.length ? (expanded ? '▾' : '▸') : ''
      ]);

      var row = h('div', {
        class: 'eruda-ng-row' + (this._selected === node ? ' selected' : '') + (matches ? '' : ' dim'),
        onmouseenter: function () {
          self._highlighter.show(node.element, node.name);
        },
        onmouseleave: function () {
          if (!self._picking) self._highlighter.hide();
        },
        onclick: function () {
          self._select(node);
        }
      }, [
        toggle,
        h('span', { class: 'eruda-ng-tag' }, [node.name]),
        node.element && node.element.id ? h('span', { class: 'eruda-ng-hash' }, ['#' + node.element.id]) : null
      ]);

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!node.children.length) return;
        self._expanded.set(node.element, !expanded);
        self._renderTree();
      });

      li.appendChild(row);

      if (node.children.length && expanded) {
        var childUl = h('ul', { class: 'eruda-ng-node' });
        node.children.forEach(function (child) {
          childUl.appendChild(this._renderNode(child));
        }, this);
        li.appendChild(childUl);
      }

      return li;
    },

    _select: function (node) {
      this._selected = node;
      this._renderTree();
      this._renderDetail(node);
      this._highlighter.show(node.element, node.name);
      if (node.element.scrollIntoView) {
        node.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },

    _renderDetail: function (node) {
      var self = this;
      clear(this._detailEl);
      if (!node) {
        this._detailEl.appendChild(h('div', { class: 'eruda-ng-empty' }, ['Select a component to inspect it.']));
        return;
      }

      var actions = h('div', { class: 'eruda-ng-toolbar' }, [
        h('button', {
          class: 'eruda-ng-btn',
          onclick: function () {
            win.__erudaNgSelected = node.component;
            win.console.log('[eruda-angular] selected component ->', node.component, node.element);
          }
        }, ['Log to console']),
        h('button', {
          class: 'eruda-ng-btn',
          onclick: function () {
            var ok = applyChangesFor(node.component);
            win.console.log('[eruda-angular] applyChanges', ok ? 'ok' : 'unsupported');
          }
        }, ['Detect changes'])
      ]);
      this._detailEl.appendChild(actions);

      this._detailEl.appendChild(h('div', { class: 'eruda-ng-section-title' }, ['Component']));
      this._detailEl.appendChild(this._renderKV('class', node.name));
      this._detailEl.appendChild(this._renderKV('element', '<' + node.element.tagName.toLowerCase() + '>'));

      this._detailEl.appendChild(h('div', { class: 'eruda-ng-section-title' }, ['Properties']));
      var keys = [];
      try { keys = Object.keys(node.component).filter(function (k) { return k.indexOf('__ngContext__') !== 0; }); } catch (e) {}
      if (!keys.length) {
        this._detailEl.appendChild(h('div', { class: 'eruda-ng-empty' }, ['No own properties.']));
      } else {
        keys.sort().forEach(function (key) {
          var val;
          try { val = node.component[key]; } catch (e) { val = undefined; }
          self._detailEl.appendChild(self._renderProp(node, key, val));
        });
      }

      var listeners = getListenersFor(node.element);
      this._detailEl.appendChild(h('div', { class: 'eruda-ng-section-title' }, ['Listeners (' + listeners.length + ')']));
      if (!listeners.length) {
        this._detailEl.appendChild(h('div', { class: 'eruda-ng-empty' }, ['None found.']));
      } else {
        listeners.forEach(function (l) {
          self._detailEl.appendChild(self._renderKV(l.name, (l.type || '') + (l.useCapture ? ' (capture)' : '')));
        });
      }
    },

    _renderKV: function (key, val) {
      return h('div', { class: 'eruda-ng-prop' }, [
        h('span', { class: 'eruda-ng-prop-key' }, [key]),
        h('span', { class: 'eruda-ng-prop-val' }, [String(val)])
      ]);
    },

    _renderProp: function (node, key, value) {
      var self = this;
      var valEl;
      if (isPrimitive(value)) {
        valEl = h('input', {
          type: 'text',
          value: String(value),
          onchange: function (e) {
            var raw = e.target.value;
            var parsed = raw;
            if (typeof value === 'number') parsed = Number(raw);
            else if (typeof value === 'boolean') parsed = raw === 'true';
            try {
              node.component[key] = parsed;
              applyChangesFor(node.component);
            } catch (err) {
              win.console.warn('[eruda-angular] could not set property', key, err);
            }
          }
        });
        var wrap = h('span', { class: 'eruda-ng-prop-val' }, [valEl]);
        return h('div', { class: 'eruda-ng-prop' }, [
          h('span', { class: 'eruda-ng-prop-key' }, [key]),
          wrap
        ]);
      }
      return h('div', { class: 'eruda-ng-prop' }, [
        h('span', { class: 'eruda-ng-prop-key' }, [key]),
        h('span', {
          class: 'eruda-ng-prop-val',
          onclick: function () {
            win.__erudaNgLast = value;
            win.console.log('[eruda-angular] ' + key + ' ->', value);
          }
        }, [safeStringify(value)])
      ]);
    },

    /* ---------------- element picker ---------------- */

    _setPicking: function (on) {
      this._picking = on;
      if (this._pickBtn) {
        this._pickBtn.classList.toggle('active', on);
      }
      if (on) {
        doc.addEventListener('mousemove', this._onPickerMove, true);
        doc.addEventListener('click', this._onPickerClick, true);
      } else {
        doc.removeEventListener('mousemove', this._onPickerMove, true);
        doc.removeEventListener('click', this._onPickerClick, true);
        this._highlighter.hide();
      }
    },

    _onPickerMove: function (e) {
      var hostEl = findNearestComponentElement(e.target);
      if (hostEl) {
        var node = this._elementToNode.get(hostEl);
        this._highlighter.show(hostEl, node ? node.name : '');
      } else {
        this._highlighter.hide();
      }
    },

    _onPickerClick: function (e) {
      var hostEl = findNearestComponentElement(e.target);
      if (hostEl) {
        e.preventDefault();
        e.stopPropagation();
        var node = this._elementToNode.get(hostEl);
        if (node) this._select(node);
      }
      this._setPicking(false);
    }
  };

export default plugin;
export { plugin };
