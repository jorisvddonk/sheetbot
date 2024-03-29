import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskIdWidget extends LitElement {
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

    getCopyText() {
        return this.data;
    }

    delete() {
        fetch(`/tasks/${this.data}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${localStorage["jwt_token"]}`
            }
        }).then(response => {
          if (response.status === 204) {
            alert("Task deleted successfully");
          } else if (response.status === 401 || response.status === 403) {
            alert("Task deletion failed - you do not have the appropriate rights!");
          } else {
            alert("Task deletion failed");
          }
        })
    }
  }
  customElements.define('widget-taskid', TaskIdWidget);