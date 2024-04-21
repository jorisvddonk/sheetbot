import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskIdWidget extends LitElement {
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
    `;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<div><span>${this.data}</span></div>`;
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

  clone() {
    fetch(`/tasks/${this.data}/clone`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${localStorage["jwt_token"]}`
        }
    }).then(response => {
      if (response.status === 204 || response.status === 200) {
        response.json().then(data => {
          alert(`Task cloned successfully. New task ID: ${data.id}`);
        }).catch(() => {
          alert("Task cloned successfully."); // cloned OK but somehow couldn't get the JSON...
        });
      } else if (response.status === 401 || response.status === 403) {
        alert("Task clone failed - you do not have the appropriate rights!");
      } else {
        alert("Task clone failed");
      }
    })
}

    getContextMenuDefinition() {
      return [
        {
          text: `delete task ${this.data}`, action: () => {
            this.delete();
          }
        },
        {
          text: `clone task ${this.data}`, action: () => {
            this.clone();
          }
        }
      ]
    }
  }
  customElements.define('widget-taskid', TaskIdWidget);