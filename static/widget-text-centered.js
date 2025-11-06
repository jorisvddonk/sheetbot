import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Display the value as centered, bold text.
 */
export class TextCenteredWidget extends LitElement {
    static styles = css`
    div {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: auto;
      grid-template-rows: auto;
      font-weight: bold;
    }

    span {
      justify-self: center;
      align-self: center;
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
      return html`<div><span>${this.data}</span></div>`;
    }

    getCopyText() {
        return this.data;
    }
  }
  customElements.define('widget-text-centered', TextCenteredWidget);