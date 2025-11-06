import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ImageWidget extends LitElement {
    static styles = css`
      div {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: auto;
        grid-template-rows: auto;
      }

      img {
        justify-self: center;
        align-self: center;
        object-fit: contain;
        width: 100%;
        height: 100%;
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
      if (this.data !== null && this.data !== undefined && this.data !== "null") {
        return html`<div><img src="${this.data}"></img></div>`;
      } else {
        return html`<span></span>`;
      }
    }

    getCopyText() {
      return this.data;
    }

    getCopyHTML() {
      return this.render();
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
      }}, {text: 'open in new tab', action: () => {
        globalThis.open(this.data);
      }}]
    }
  }
  customElements.define('widget-image', ImageWidget);