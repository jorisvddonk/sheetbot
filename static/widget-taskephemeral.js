import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskEphemeralWidget extends LitElement {
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

      .persistent {
          background: #00f5d4;
      }
      .ephemeral_on_success {
          background: #00bbf9;
      }
      .ephemeral_always {
          background: #fee440;
      }
    `;
  
    static properties = {
      data: {type: Number},
    };
  
    constructor() {
      super();
      this.data = -1;
    }

    numberToEphemeralness(num) {
      if (num == 0) {
        return "persistent";
      }
      if (num == 1) {
        return "ephemeral_on_success";
      }
      if (num == 2) {
        return "ephemeral_always";
      }
    }

    render() {
      return html`<div class="${this.numberToEphemeralness(this.data)}"><span>${this.numberToEphemeralness(this.data)}</span></div>`;
    }

    getCopyText() {
        return this.numberToEphemeralness(this.data);
    }
  }
  customElements.define('widget-taskephemeral', TaskEphemeralWidget);