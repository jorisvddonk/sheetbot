import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

const TYPE_NAMES = [
  "medium size, internally hot, unstable surface, no atmosphere",
  "small, solid, dusty, craterized, no atmosphere",
  "medium size, solid, thick atmosphere, fully covered by clouds",
  "medium size, felisian, breathable atmosphere, suitable for life",
  "medium size, rocky, creased, no atmosphere",
  "small, solid, thin atmosphere",
  "large, not consistent, covered with dense clouds",
  "small, solid, icy surface, no atmosphere",
  "medium size, surface is mainly native quartz, oxygen atmosphere",
  "very large, substellar object, not consistent",
  "companion star - not a planet",
];

export class NoctisTypeWidget extends LitElement {
  static styles = css``;

  static properties = {
    data: {type: String},
  };

  constructor() {
    super();
    this.data = '';
  }

  render() {
    if (this.data === null || this.data === undefined || this.data === '' || this.data === 'null') {
      return html``;
    }
    const n = parseInt(this.data, 10);
    const name = Number.isFinite(n) ? TYPE_NAMES[n] : undefined;
    if (name) {
      return html`<span title="type ${n}">${n} — ${name}</span>`;
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

customElements.define('widget-noctis-type', NoctisTypeWidget);
