import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TextWidget extends LitElement {
    static styles = css``;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<span>${this.data}</span>`;
    }
  }
  customElements.define('widget-text', TextWidget);