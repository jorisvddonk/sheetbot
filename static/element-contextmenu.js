import { css, LitElement, createRef, ref, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ContextMenuElement extends LitElement {
    static styles = css`
    @import url("https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;1,100;1,400;1,700&display=swap");
    * {
      box-sizing: border-box;
    }
    
    .context-menu {}
    .context-menu.open > .menu-items {
      scale: 1 1;
      opacity: 1;
    }
    .context-menu .menu-items {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      gap: 0.25rem;
      padding: 0.25rem;
      margin: 0;
      min-width: 15ch;
      width: max-content;
      max-width: 60ch;
      background-color: #111;
      border-radius: 0.2em;
      opacity: 0;
      scale: 1 0;
      transform-origin: top center;
      transition: none;
    }
    .context-menu .menu-items > .menu-item {
      padding: 0 1rem;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 2rem;
      border-radius: 0.2em;
      overflow: visible;
      background-color: white;
      transition: background-color 0.15s ease-out;
      position: relative;
      user-select: none;
    }
    .context-menu .menu-items > .menu-item:hover, .context-menu .menu-items > .menu-item:hover * {
      cursor: pointer;
    }
    .context-menu .menu-items > .menu-item:hover {
      background-color: lightgray;
    }
    .context-menu .menu-items > .menu-item.divider {
      height: 0.25rem;
      background-color: white;
      pointer-events: none;
    }
    .context-menu .menu-items > .menu-item:has(button) > button {
      width: 100%;
      height: 100%;
      border: none;
      background-color: transparent;
      font-size: 1rem;
      color: black;
      padding: 0 0.5rem;
      border-radius: 0.2em;
      transition: background-color 0.15s ease-out;
    }
    .context-menu .menu-items > .menu-item.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .context-menu .menu-items > .menu-item.disabled:hover, .context-menu .menu-items > .menu-item.disabled:hover * {
      cursor: default;
      pointer-events: none;
      background-color: white;
    }
    `;
    
    static properties = {
        items: { type: Array }
    };

    contextMenuRef = createRef();
    eventlistener = null;

    constructor() {
        super();
        this.items = [];
    }

    setItems(items) {
        this.items = items;
    }

    show() {
        this.contextMenuRef.value.classList.add('open');
        this.eventlistener = document.addEventListener("mousedown", (event) => {
            if (!(this.contextMenuRef.value.contains(event.target) || event.target === this)) {
                this.hide();
            }
        });
    }

    hide() {
        this.contextMenuRef.value.classList.remove('open');
        if (this.eventlistener) {
            document.removeEventListener("mousedown", this.eventlistener);
            this.eventlistener = null;
        }
    }

    render() {
        return html`
        <div ${ref(this.contextMenuRef)} class="context-menu">
            <ul class="menu-items">
                ${this.items && this.items.map(item => {
                    return html`<li class="menu-item"><button @click="${event => {
                        item.action();
                        this.hide();
                    }}">${item.text}</button></li>`
                })}
            </ul>
        </div>
        `;
    }
}

customElements.define('element-contextmenu', ContextMenuElement);