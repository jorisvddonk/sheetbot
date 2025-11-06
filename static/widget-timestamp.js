import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Display a timestamp as a nicely formatted relative time string.
 */
export class TimestampWidget extends LitElement {
    static styles = css`
    div {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: auto;
      grid-template-rows: auto;
    }

    span {
      justify-self: center;
      align-self: center;
    }
    `;

    static properties = {
      data: {type: Number},
    };

    constructor() {
      super();
      this.data = 0;
    }

    render() {
      const formatted = this.formatTimestamp(this.data);
      return html`<div><span>${formatted}</span></div>`;
    }

    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    }

    getCopyText() {
        return this.data.toString();
    }
  }
  customElements.define('widget-timestamp', TimestampWidget);