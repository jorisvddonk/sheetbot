import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * A button widget to schedule a task using the given script filename.
 */
export class ScheduleTaskWidget extends LitElement {
    static styles = css`
    div {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    button {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background-color: #0056b3;
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
      return html`<div><button @click=${this.scheduleTask}>Schedule Task</button></div>`;
    }

    scheduleTask() {
      // Navigate to addtask page with script parameter
      globalThis.location.href = `/addtask.html?script=${encodeURIComponent(this.data)}`;
    }

    getCopyText() {
        return this.data;
    }
  }
  customElements.define('widget-schedule-task', ScheduleTaskWidget);