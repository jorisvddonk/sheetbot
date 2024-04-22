import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Display the value as text, but try to be smart about it and show non-strings with an additional style.
 */
export class TextWidget extends LitElement {
    static styles = css`
    span.null {
      font-style: italic;
    }
    
    span.boolean {
      font-style: italic;
    }

    span.undefined {
      font-style: italic;
    }

    span.number {
      font-style: italic;
    }

    span.object {
      font-style: italic;
      font-family: monospace;
    }

    span.array {
      font-style: italic;
      font-family: monospace;
    }
    `;
  
    static properties = {
      data: {type: String},
      datatype: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<span class="${this.datatype}">${this.data}</span>`;
    }

    getCopyText() {
        return this.data;
    }
  }
  customElements.define('widget-text', TextWidget);