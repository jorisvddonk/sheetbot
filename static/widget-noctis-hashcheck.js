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
    if (!this.rowkey || !this.column || this.data === null || this.data === undefined || this.data === '') {
      return;
    }
    if (!this.column.startsWith("rust_")) {
      this.match = "plain";
      this.requestUpdate();
      return;
    }
    const origCol = this.column.replace(/^rust_/, 'orig_');
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
    if (this.match === "plain") {
      return html`<span class="plain" title="${this.column}">${this.data}</span>`;
    }
    if (this.match === true) {
      return html`<span class="ok" title="rust ${this.data} == orig">✓ ${this.data}</span>`;
    }
    if (this.match === false) {
      return html`<span class="bad" title="rust ${this.data} != orig">✗ ${this.data}</span>`;
    }
    return html`<span class="unknown" title="no orig reference">–</span>`;
  }

  getCopyText() {
    return this.data;
  }

  getCopyHTML() {
    return this.render();
  }
}

customElements.define('widget-noctis-hashcheck', NoctisHashCheckWidget);
