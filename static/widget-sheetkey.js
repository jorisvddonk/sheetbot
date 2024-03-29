import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class SheetKeyWidget extends LitElement {
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
      fetch(`/sheets/${new URL(document.URL).searchParams.get('sheet')}/data/${this.data}`, {
          method: "DELETE",
          headers: {
              Authorization: `Bearer ${localStorage["jwt_token"]}`
          }
      }).then(response => {
        if (response.status === 204) {
          alert("Sheet row deleted successfully");
        } else if (response.status === 401 || response.status === 403) {
          alert("Sheet row deletion failed - you do not have the appropriate rights!");
        } else {
          alert("Sheet row deletion failed");
        }
      })
    }
  }
  customElements.define('widget-sheetkey', SheetKeyWidget);