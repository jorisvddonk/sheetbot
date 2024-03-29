import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ImageWidget extends LitElement {
    static styles = css``;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      return html`<img src="${this.data}"></img>`;
    }

    getCopyText() {
      return this.data;
    }

    getCopyHTML() {
      return `<img src="${this.data}"></img>`;
    }

    delete() {
      fetch(this.data, {
          method: "DELETE",
          headers: {
              Authorization: `Bearer ${localStorage["jwt_token"]}`
          }
      }).then(response => {
        if (response.status === 204) {
          alert("Image deleted successfully");
        } else if (response.status === 401 || response.status === 403) {
          alert("Image deletion failed - you do not have the appropriate rights!");
        } else {
          alert("Image deletion failed");
        }
      })
    }

    getContextMenuDefinition() {
      return [{text: 'delete', action: () => {
        this.delete();
      }}]
    }
  }
  customElements.define('widget-image', ImageWidget);