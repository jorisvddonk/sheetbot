import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ProgressWidget extends LitElement {
    static styles = css`
      .progress-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px;
      }

      .progress-bar {
        flex: 1;
        height: 12px;
        background: #e9ecef;
        border-radius: 6px;
        overflow: hidden;
        position: relative;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
        border-radius: 6px;
        transition: width 0.3s ease;
        position: relative;
      }

      .progress-fill.warning {
        background: linear-gradient(90deg, #ffc107 0%, #fd7e14 100%);
      }

      .progress-fill.danger {
        background: linear-gradient(90deg, #dc3545 0%, #e83e8c 100%);
      }

      .progress-text {
        font-size: 12px;
        font-weight: bold;
        color: #495057;
        min-width: 35px;
        text-align: right;
      }

      .progress-animated .progress-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.3),
          transparent
        );
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;

    static properties = {
      data: {type: Number},
    };

    constructor() {
      super();
      this.data = 0;
    }

    render() {
      const percentage = Math.max(0, Math.min(100, this.data || 0));
      const isWarning = percentage >= 50 && percentage < 80;
      const isDanger = percentage >= 80;
      const isAnimated = percentage > 0 && percentage < 100;

      return html`
        <div class="progress-container">
          <div class="progress-bar ${isAnimated ? 'progress-animated' : ''}">
            <div
              class="progress-fill ${isWarning ? 'warning' : ''} ${isDanger ? 'danger' : ''}"
              style="width: ${percentage}%"
            ></div>
          </div>
          <span class="progress-text">${percentage}%</span>
        </div>
      `;
    }

    getCopyText() {
      return `${this.data || 0}%`;
    }

    getCopyHTML() {
      return `<div>${this.getCopyText()}</div>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy percentage',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        }
      ];
    }
  }

customElements.define('widget-progress', ProgressWidget);