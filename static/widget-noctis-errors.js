import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class NoctisErrorsWidget extends LitElement {
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
  `;

  static properties = {
    data: {type: String},
  };

  constructor() {
    super();
    this.data = '';
  }

  render() {
    if (this.data === null || this.data === undefined || this.data === '') {
      return html`<span class="unknown" title="no data">–</span>`;
    }
    const n = parseInt(String(this.data), 10);
    if (Number.isFinite(n) && n > 0) {
      return html`<span class="bad" title="${n} errors">✗ ${n}</span>`;
    }
    if (Number.isFinite(n) && n === 0) {
      return html`<span class="ok" title="0 errors">✓</span>`;
    }
    return html`<span class="unknown" title="no data">–</span>`;
  }

  getCopyText() {
    return this.data;
  }

  getCopyHTML() {
    return this.render();
  }
}

customElements.define('widget-noctis-errors', NoctisErrorsWidget);
