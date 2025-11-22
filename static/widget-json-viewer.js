import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class JsonViewerWidget extends LitElement {
    static styles = css`
      .json-container {
        font-family: monospace;
        font-size: 12px;
        line-height: 1.4;
        max-height: 200px;
        overflow-y: auto;
        padding: 4px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .json-key {
        color: #0066cc;
        font-weight: bold;
      }

      .json-string {
        color: #008000;
      }

      .json-number {
        color: #ff6600;
      }

      .json-boolean {
        color: #990099;
        font-weight: bold;
      }

      .json-null {
        color: #666;
        font-style: italic;
      }

       .json-toggle {
         cursor: pointer;
         user-select: none;
         margin-right: 4px;
         color: #007bff;
         font-weight: bold;
         font-size: 10px;
         padding: 2px 4px;
         border-radius: 2px;
         transition: all 0.2s ease;
       }

       .json-toggle:hover {
         background: #e9ecef;
         color: #0056b3;
         transform: scale(1.1);
       }

      .json-collapsed {
        display: none;
      }

      .json-bracket {
        color: #000;
      }

      .json-indent {
        margin-left: 20px;
      }

      @media (prefers-color-scheme: dark) {
        .json-container {
          background: #2d3748;
          color: #e2e8f0;
        }

        .json-key {
          color: #63b3ed;
        }

        .json-string {
          color: #68d391;
        }

        .json-number {
          color: #fbb6ce;
        }

        .json-boolean {
          color: #d53f8c;
        }

        .json-null {
          color: #a0aec0;
        }

        .json-toggle {
          color: #4299e1;
        }

        .json-toggle:hover {
          background: #4a5568;
          color: #3182ce;
        }

        .json-bracket {
          color: #e2e8f0;
        }
      }
    `;

    static properties = {
      data: {type: Object},
      defaultDepth: {type: Number},
    };

    constructor() {
      super();
      this.data = null;
      this.defaultDepth = 1; // Expand first level by default
    }

    render() {
      if (!this.data || typeof this.data !== 'object') {
        return html`<div class="json-container">${JSON.stringify(this.data, null, 2)}</div>`;
      }
      return html`<div class="json-container">${this.renderJson(this.data)}</div>`;
    }

    renderJson(obj, indent = 0) {
      if (obj === null) {
        return html`<span class="json-null">null</span>`;
      }

      if (typeof obj === 'boolean') {
        return html`<span class="json-boolean">${obj}</span>`;
      }

      if (typeof obj === 'number') {
        return html`<span class="json-number">${obj}</span>`;
      }

      if (typeof obj === 'string') {
        return html`<span class="json-string">"${obj}"</span>`;
      }

      if (Array.isArray(obj)) {
        return this.renderArray(obj, indent);
      }

      if (typeof obj === 'object') {
        return this.renderObject(obj, indent);
      }

      return html`${String(obj)}`;
    }

    renderArray(arr, indent) {
      if (arr.length === 0) {
        return html`<span class="json-bracket">[]</span>`;
      }

      const isExpanded = this.getExpandedState(`array-${indent}`);
      const toggleIcon = isExpanded ? '▼' : '▶';

      return html`
        <div>
          <span class="json-toggle" @click=${() => this.toggleExpanded(`array-${indent}`)}>${toggleIcon}</span>
          <span class="json-bracket">[</span>
          <div class="json-indent ${isExpanded ? '' : 'json-collapsed'}">
            ${arr.map((item, index) => html`
              <div>${this.renderJson(item, indent + 1)}${index < arr.length - 1 ? ',' : ''}</div>
            `)}
          </div>
          <span class="json-bracket">]</span>
        </div>
      `;
    }

    renderObject(obj, indent) {
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return html`<span class="json-bracket">{}</span>`;
      }

      const isExpanded = this.getExpandedState(`object-${indent}`);
      const toggleIcon = isExpanded ? '▼' : '▶';

      return html`
        <div>
          <span class="json-toggle" @click=${() => this.toggleExpanded(`object-${indent}`)}>${toggleIcon}</span>
          <span class="json-bracket">{</span>
          <div class="json-indent ${isExpanded ? '' : 'json-collapsed'}">
            ${keys.map((key, index) => html`
              <div>
                <span class="json-key">"${key}"</span>: ${this.renderJson(obj[key], indent + 1)}${index < keys.length - 1 ? ',' : ''}
              </div>
            `)}
          </div>
          <span class="json-bracket">}</span>
        </div>
      `;
    }

    getExpandedState(key) {
      if (!this._expandedStates) {
        this._expandedStates = new Set();
        // Initialize with default expanded states based on depth
        this.initializeDefaultExpansion(this.data, 0);
      }
      return this._expandedStates.has(key);
    }

    initializeDefaultExpansion(obj, currentDepth) {
      if (!obj || currentDepth >= this.defaultDepth) return;

      if (Array.isArray(obj)) {
        this._expandedStates.add(`array-${currentDepth}`);
        obj.forEach(item => this.initializeDefaultExpansion(item, currentDepth + 1));
      } else if (typeof obj === 'object' && obj !== null) {
        this._expandedStates.add(`object-${currentDepth}`);
        Object.values(obj).forEach(value => this.initializeDefaultExpansion(value, currentDepth + 1));
      }
    }

    toggleExpanded(key) {
      if (!this._expandedStates) {
        this._expandedStates = new Set();
      }
      if (this._expandedStates.has(key)) {
        this._expandedStates.delete(key);
      } else {
        this._expandedStates.add(key);
      }
      this.requestUpdate();
    }

    getCopyText() {
      return JSON.stringify(this.data, null, 2);
    }

    getCopyHTML() {
      return `<pre>${this.getCopyText()}</pre>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy JSON',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        },
        {
          text: 'expand all',
          action: () => {
            this._expandedStates = new Set();
            // Add all possible keys (this is a simple implementation)
            this.expandAll(this.data, 0);
            this.requestUpdate();
          }
        },
        {
          text: 'collapse all',
          action: () => {
            this._expandedStates = new Set();
            this.requestUpdate();
          }
        }
      ];
    }

    expandAll(obj, indent) {
      if (Array.isArray(obj)) {
        this._expandedStates.add(`array-${indent}`);
        obj.forEach(item => this.expandAll(item, indent + 1));
      } else if (typeof obj === 'object' && obj !== null) {
        this._expandedStates.add(`object-${indent}`);
        Object.values(obj).forEach(value => this.expandAll(value, indent + 1));
      }
    }
  }

customElements.define('widget-json-viewer', JsonViewerWidget);