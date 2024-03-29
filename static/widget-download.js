import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class DownloadWidget extends LitElement {
    static styles = css`
    a {
        display: block;
        width: 100%;
        text-align: center;
    }`;
  
    static properties = {
      data: {type: String},
    };
  
    constructor() {
      super();
      this.data = '';
    }

    render() {
      if (this.data !== null && this.data !== undefined && this.data !== "null") {
        return html`<a href="${this.data}" target="_blank" title="${this.data}">Download</a>`;
      } else {
        return html`<span></span>`;
      }
    }

    getCopyText() {
      return this.data;
    }

    getCopyHTML() {
      return this.data;
    }

    delete() {
      fetch(this.data, {
          method: "DELETE",
          headers: {
              Authorization: `Bearer ${localStorage["jwt_token"]}`
          }
      }).then(response => {
        if (response.status === 204) {
          alert("Download artefact deleted successfully");
        } else if (response.status === 401 || response.status === 403) {
          alert("Download artefact deletion failed - you do not have the appropriate rights!");
        } else {
          alert("Download artefact deletion failed");
        }
      })
    }
  }
  customElements.define('widget-download', DownloadWidget);