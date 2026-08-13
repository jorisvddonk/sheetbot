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
      loaded: {type: Boolean},
    };

    constructor() {
      super();
      this.data = '';
      this.loaded = false;
      this._observer = null;
    }

    connectedCallback() {
      super.connectedCallback();
      if (this.data === null || this.data === undefined || this.data === "null" || this.data === "") {
        return;
      }
      if (typeof IntersectionObserver === "undefined") {
        this.loaded = true;
        return;
      }
      this._observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.loaded = true;
            this._observer?.disconnect();
            this._observer = null;
            break;
          }
        }
      }, { rootMargin: "100px" });
      this._observer.observe(this);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    }

    render() {
      if (this.loaded && this.data !== null && this.data !== undefined && this.data !== "null" && this.data !== "") {
        return html`<div><img src="${this.data}" loading="lazy"></img></div>`;
      }
      return html`<div></div>`;
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
