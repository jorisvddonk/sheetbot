import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TransitionsWidget extends LitElement {
    static styles = css`
       div {
         width: 100%;
         overflow-x: hidden;
         overflow-y: auto;
         font-size: 11px;
         font-family: sans-serif;
         background: transparent;
         color: inherit;
         line-height: 1.0;
       }

      .transition {
        border: 1px solid rgba(128, 128, 128, 0.3);
        margin: 0 1px 1px 1px;
        padding: 1px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
        width: calc(100% - 4px);
      }

      @media (prefers-color-scheme: dark) {
        .transition {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
      }

       .transition-header {
         font-weight: bold;
         margin-bottom: 1px;
         color: inherit;
         white-space: nowrap;
       }

       .status-awaiting {
         color: #fee440;
       }
       .status-running {
         color: #f9dcc4;
       }
       .status-completed {
         color: #00bbf9;
       }
       .status-failed {
         color: #f15bb5;
       }
       .status-paused {
         color: #777;
       }

      .transition-detail {
        font-size: 10px;
        color: inherit;
        margin: 0 0 0 4px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: calc(100% - 4px);
      }

      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      }
    `;

    static properties = {
      data: {type: String},
      rowkey: {type: String}
    };

    constructor() {
      super();
      this.data = '[]';
      this.rowkey = "";
    }

    render() {
      let transitions = [];
      try {
        transitions = JSON.parse(this.data);
      } catch (e) {
        return html`<div>Error parsing transitions</div>`;
      }

      if (!Array.isArray(transitions)) {
        return html`<div>Transitions data is not an array</div>`;
      }

      return html`<div>
        ${transitions.map((transition, index) => {
          const timing = transition.timing?.immediate ? 'immediate' : transition.timing?.every ? transition.timing.every : 'Unk';
          return html`
            <div class="transition">
               <div class="transition-header">T${index + 1}: ${transition.statuses ? transition.statuses.map((s, i) => html`${i > 0 ? ', ' : ''}<span class="status-${s.toLowerCase()}">${s}</span>`).reduce((acc, curr) => html`${acc}${curr}`, html``) : html`None`}→<span class="status-${(transition.transitionTo || '').toLowerCase()}">${transition.transitionTo || '?'}</span> (${timing})</div>
              <div class="transition-detail">Cond: ${JSON.stringify(transition.condition || {}, null, 2)}</div>
              ${transition.dataMutations ? html`<div class="transition-detail">Mut: ${JSON.stringify(transition.dataMutations, null, 2)}</div>` : ''}
            </div>
          `;
        })}
      </div>`;
    }

    getCopyText() {
      return this.data;
    }
  }
  customElements.define('widget-transitions', TransitionsWidget);