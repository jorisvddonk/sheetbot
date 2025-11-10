import { html, css, LitElement } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class MultiWidget extends LitElement {
    static styles = css``;

    static properties = {
        data: { type: String },
        selectedSlot: { type: Number },
        numSlots: { type: Number },
        slotTypes: { type: Array }
    };

    constructor() {
        super();
        this.data = '';
        this.selectedSlot = 1;
        this.numSlots = 1;
        this.slotTypes = [];
    }

    showSlot(i) {
        this.selectedSlot = i;
    }

    getContextMenuDefinition() {
        const retval = [];
        for (let i = 0; i < this.numSlots; i++) {
            const type = this.slotTypes[i] || 'unknown';
            retval.push({
                text: `show slot ${i+1} (${type})`, action: () => {
                    this.showSlot(i+1);
                }
            })
        }
        return retval;
    }

    render() {
        const elements = [];
        for (let i = 0; i < this.numSlots; i++) {
            elements.push(html`<slot name="${i+1}" style="display: ${this.selectedSlot === i+1 ? 'unset' : 'none'}"></slot>`);
        }
        return html`${elements}`;
    }
}
customElements.define('widget-multi', MultiWidget);