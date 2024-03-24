import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ImageWidget extends LitElement {
    static styles = css``;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<img src="${this.data}"></img>`;
    }
  }
  customElements.define('widget-image', ImageWidget);