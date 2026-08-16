import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class NoctisHashCheckWidget extends LitElement {
  static styles = css`
    .ok {
      color: #2196F3;
      font-weight: bold;
      font-family: monospace;
      white-space: nowrap;
    }
    .bad {
      color: #F44336;
      font-weight: bold;
      font-family: monospace;
      white-space: nowrap;
    }
    .unknown {
      color: #9E9E9E;
      font-family: monospace;
      white-space: nowrap;
    }
    .plain {
      font-family: monospace;
      white-space: nowrap;
    }
  `;

  static properties = {
    data: {type: String},
    column: {type: String},
    rowkey: {type: String},
  };

  constructor() {
    super();
    this.data = '';
    this.column = '';
    this.rowkey = '';
    this.match = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.check();
  }

  check() {
    if (this.data === null || this.data === undefined || this.data === '' || this.data === 'null') {
      this.match = "empty";
      return;
    }
    if (!this.rowkey || !this.column) {
      return;
    }
    if (!/^(rust|lr|lino)_/.test(this.column)) {
      this.match = "plain";
      this.requestUpdate();
      return;
    }
    const origCol = this.column.replace(/^(rust|lr|lino)_/, 'orig_');
    try {
      const grid = this.closest('element-grid');
      if (!grid || !grid.data) {
        this.match = "unknown";
      } else {
        const columns = grid.getColumnDefinitions();
        const row = grid.getRowData(this.rowkey);
        if (!columns || !row) {
          this.match = "unknown";
        } else {
          const idx = columns.findIndex((c) => c.name === origCol);
          const orig = idx !== -1 ? row[idx] : undefined;
          if (orig === undefined || orig === null) {
            this.match = "unknown";
          } else {
            this.match = String(orig) === String(this.data);
          }
        }
      }
    } catch (e) {
      this.match = "unknown";
    }
    this.requestUpdate();
  }

  render() {
    if (this.match === "empty") {
      return html``;
    }
    if (this.match === "plain") {
      return html`<span class="plain" title="${this.column}">${this.data}</span>`;
    }
    if (this.match === true) {
      return html`<span class="ok" title="${this.column} == orig">✓ ${this.data}</span>`;
    }
    if (this.match === false) {
      return html`<span class="bad" title="${this.column} != orig">✗ ${this.data}</span>`;
    }
    return html`<span class="plain" title="${this.column} (no orig reference yet)">${this.data}</span>`;
  }

  getCopyText() {
    return this.data;
  }

  getCopyHTML() {
    return this.render();
  }
}

customElements.define('widget-noctis-hashcheck', NoctisHashCheckWidget);
