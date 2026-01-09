import { html, css, LitElement } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { Task } from 'https://cdn.jsdelivr.net/npm/@lit/task@1.0.0/+esm';

export class HashImgWidget extends LitElement {
    static styles = css``;

    static properties = {
        data: { type: String }
    };

    constructor() {
        super();
        this.data = '';
    }

    getCopyText() {
        if (this.data !== null && this.data !== undefined) {
            if (typeof this.data === "object") {
                try {
                    return JSON.stringify(this.data, null, 2);
                } catch (e) {
                    console.warn("widget-hashimg: Can't JSON stringify object.. reverting back to original representation!", e);
                    return this.data;
                }
            } else {
                return this.data;
            }
        } else {
            return '';
        }
    }

    _hashTask = new Task(this, {
        task: async ([data]) => {
            if (data !== null && data !== undefined) {
                let d;
                if (typeof data === "object") {
                    try {
                        d = JSON.stringify(data, null, 2);
                    } catch (e) {
                        console.warn("widget-code: Can't JSON stringify object.. revering back to original representation!", e);
                        d = data;
                    }
                } else {
                    d = data;
                }
                const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(d));
                const hashArray = Array.from(new Uint8Array(hashBuffer));

                 const canvas = document.createElement("canvas");
                 canvas.setAttribute("style", `width: 128px; height: 128px; padding: 0px; margin: 0px;`)
                 const ctx = canvas.getContext("2d");
                 ctx.canvas.width = 128;
                 ctx.canvas.height = 128;
                 const isDark = globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
                 ctx.fillStyle = isDark ? `rgb(0 0 0)` : `rgb(255 255 255)`;
                 ctx.fillRect(0, 0, 128, 128);
                for (let i = 0; i < 16; i++) {
                    ctx.fillStyle = `rgba(${hashArray[0]}, ${hashArray[1]}, ${hashArray[2]}, ${hashArray[i + 3] / 255})`;
                    const x = i % 4;
                    const y = Math.floor(i / 4);
                    const size = (120 / 4);
                    const x0 = 4 + (x * size);
                    const y0 = 4 + (y * size);
                    ctx.fillRect(x0, y0, size, size);
                }
                canvas.setAttribute("title", hashArray.map(a => ('00' + a.toString(16)).slice(-2)).join(''));

                return canvas;
            } else {
                return null;
            }
        },
        args: () => [this.data]
    });

    render() {
        return this._hashTask.render({
            pending: () => html`<span>...</span>`,
            complete: (canvas) => html`${canvas}<slot name="one"></slot>`,
            error: (e) => html`<span>ERROR: ${e}</span>`
        });
    }
}
customElements.define('widget-hashimg', HashImgWidget);