import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Display a timestamp as a nicely formatted relative time string.
 */
export class RelativeTimestampWidget extends LitElement {
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
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    }

    getCopyText() {
        return this.data.toString();
    }
  }
  customElements.define('widget-relative-timestamp', RelativeTimestampWidget);