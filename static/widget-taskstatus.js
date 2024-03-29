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
      rowkey: {type: String}
    };
  
    constructor() {
      super();
      this.data = -1;
      this.rowkey = "";
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

    setStatus(newStatus) {
      let status = 0;
      if (newStatus === 'awaiting') {
        status = 0;
      } else if (newStatus === 'completed') {
        status = 2;
      } else if (newStatus === 'failed') {
        status = 3;
      }
      fetch(`/tasks/${this.rowkey}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${localStorage["jwt_token"]}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status
        })
      }).then(response => {
        if (response.status === 204) {
          alert("Task status updated successfully");
        } else if (response.status === 401 || response.status === 403) {
          alert("Task status update failed - you do not have the appropriate rights!");
        } else {
          alert("Task status update failed");
        }
      });
    }

    getContextMenuDefinition() {
      return [
        {
          text: `reset to 'awaiting'`, action: () => {
            this.setStatus('awaiting');
          }
        },
        {
          text: `set to 'completed'`, action: () => {
            this.setStatus('completed');
          }
        },
        {
          text: `set to 'failed'`, action: () => {
            this.setStatus('failed');
          }
        }
      ]
    }
  }
  customElements.define('widget-taskstatus', TaskStatusWidget);