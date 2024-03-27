import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskStatusWidget extends LitElement {
    static styles = css`
      div {

      }
      div.awaiting {
        background: #fee440;
      }
      div.running {
        background: #f9dcc4;
      }
      div.completed {
        background: #00bbf9;
      }
      div.failed {
        background: #f15bb5;
      }
    `;
  
    static properties = {
      data: {type: Number},
    };
  
    constructor() {
      super();
      this.data = -1;
    }

    numberToStatus(num) {
      if (num == 0) {
        return "awaiting";
      }
      if (num == 1) {
        return "running";
      }
      if (num == 2) {
        return "completed";
      }
      if (num == 3) {
        return "failed";
      }
    }

    render() {
      return html`<div class="${this.numberToStatus(this.data)}">${this.numberToStatus(this.data)}</div>`;
    }

    getCopyText() {
        return this.numberToStatus(this.data);
    }
  }
  customElements.define('widget-taskstatus', TaskStatusWidget);