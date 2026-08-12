import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class NoctisIsMoonWidget extends LitElement {
  static styles = css``;

  static properties = {
    data: {type: String},
  };

  constructor() {
    super();
    this.data = '';
  }

  render() {
    const v = String(this.data).trim();
    if (v === "1" || v === "true") {
      return html`<span>yes</span>`;
    }
    if (v === "0" || v === "false") {
      return html`<span>no</span>`;
    }
    return html`<span>${this.data}</span>`;
  }

  getCopyText() {
    return this.data;
  }

  getCopyHTML() {
    return this.render();
  }
}

customElements.define('widget-noctis-is-moon', NoctisIsMoonWidget);
