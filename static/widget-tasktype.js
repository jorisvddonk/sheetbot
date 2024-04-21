import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskTypeWidget extends LitElement {
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

      .deno {
        background-image: url('Deno_2021.svg');
        background-repeat: no-repeat;
        background-size: 50%;
        background-position: center;
      }
      .deno span {
        display: none;
      }
    `;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = "";
    }

    render() {
      return html`<div class="${this.data}" title="${this.data}"><span>${this.data}</span></div>`;
    }

    getCopyText() {
        return this.data;
    }
  }
  customElements.define('widget-tasktype', TaskTypeWidget);