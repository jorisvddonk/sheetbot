import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskEphemeralWidget extends LitElement {
    static styles = css`
      div.persistent {
          background: #00f5d4;
      }
      div.ephemeral_on_success {
          background: #00bbf9;
      }
      div.ephemeral_always {
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
      return html`<div class="${this.numberToEphemeralness(this.data)}">${this.numberToEphemeralness(this.data)}</div>`;
    }

    getCopyText() {
        return this.numberToEphemeralness(this.data);
    }
  }
  customElements.define('widget-taskephemeral', TaskEphemeralWidget);