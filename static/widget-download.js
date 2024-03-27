import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class DownloadWidget extends LitElement {
    static styles = css`
    a {
        display: block;
        width: 100%;
        text-align: center;
    }`;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<a href="${this.data}" target="_blank" title="${this.data}">Download</a>`;
    }

    getCopyText() {
      return this.data;
    }

    getCopyHTML() {
      return this.data;
    }
  }
  customElements.define('widget-download', DownloadWidget);