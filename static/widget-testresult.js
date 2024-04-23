import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Display a test result (boolean), otherwise show the raw value as text. Booleans are automatically interpreted as success/failure.
 * Note: non-booleans really aren't intended to be supported by this widget!
 * In the future, text could automatically be parsed somehow to determine success.
 */
export class TestResultWidget extends LitElement {
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
        height: 100%;
    }

    span.null {
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

    div.success_unknown {}
    div.success_true {
        background-color: #aaf;
    }
    div.success_true span::after {
        content: '✅';
        text-align: center;
    }
    div.success_false {
        background-color: #faa;
    }
    div.success_false span::after {
        content: '❌';
        text-align: center;
        justify-self: center;
        align-self: center;
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
        if (this.datatype === 'boolean') {
            return html`<div class="success_${this.data}"><span class="${this.datatype}"></span></div>`
        } else {
            return html`<div class="success_unknown"><span class="${this.datatype}">${this.data}</span></div>`;
        }
    }

    getCopyText() {
        return this.data;
    }
  }
  customElements.define('widget-testresult', TestResultWidget);