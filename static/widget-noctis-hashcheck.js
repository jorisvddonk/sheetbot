import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

let sheetPromise = null;

function getSheet() {
  if (!sheetPromise) {
    sheetPromise = (async () => {
      const sheet = new URL(document.URL).searchParams.get('sheet');
      const res = await fetch(`/sheets/${sheet}`, {
        headers: {
          Authorization: `Bearer ${localStorage["jwt_token"]}`
        }
      });
      const data = await res.json();
      const columns = data.columns.map((c) => c.name);
      const rows = new Map();
      for (const row of data.rows) {
        const obj = {};
        columns.forEach((name, i) => {
          obj[name] = row[i];
        });
        rows.set(obj["key"], obj);
      }
      return { rows };
    })();
  }
  return sheetPromise;
}

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

  async check() {
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
      const sheet = await getSheet();
      const row = sheet.rows.get(this.rowkey);
      const orig = row ? row[origCol] : undefined;
      if (orig === undefined || orig === null) {
        this.match = "unknown";
      } else {
        this.match = String(orig) === String(this.data);
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
