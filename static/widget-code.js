import {html, css, LitElement, unsafeHTML} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import hljs from 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/es/highlight.min.js';

export class CodeWidget extends LitElement {
    static styles = css``;
  
    static properties = {
      data: {type: String}
    };
  
    constructor() {
      super();
      this.data = '';
    }

    createRenderRoot() {
        return this; // allow hljs css to leak in. TODO: find a way to import Highlightjs CSS here?
    }
  
    render() {
        if (this.data !== null && this.data !== undefined) {
            let highlight;
            if (typeof this.data === "object") {
                try {
                    highlight = hljs.highlightAuto(JSON.stringify(this.data, null, 2));
                } catch (e) {
                    console.warn("widget-code: Can't JSON stringify object.. revering back to original representation!", e);
                    highlight = hljs.highlightAuto(this.data);
                }
            } else {
                highlight = hljs.highlightAuto(this.data);
            }
            return html`<pre><code class="hljs">${unsafeHTML(highlight.value)}</code></pre>`;
        } else {
            return html`<div></div>`;
        }
    }
  }
  customElements.define('widget-code', CodeWidget);