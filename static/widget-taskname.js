import { html, css, LitElement } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TaskNameWidget extends LitElement {
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
        font-weight: bold;
      }
    `;

    static properties = {
        data: { type: String },
    };

    constructor() {
        super();
    }

    render() {
        if (this.data !== null && this.data !== undefined && this.data !== 'null' && this.data !== '') {
            return html`<div><span>${this.data}</span></div>`;
        }
        return html`<span></span>`;
    }

    getCopyText() {
        return this.data;
    }

}

customElements.define('widget-taskname', TaskNameWidget);