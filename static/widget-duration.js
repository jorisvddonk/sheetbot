import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class DurationWidget extends LitElement {
    static styles = css`
      .duration-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 13px;
        font-weight: 500;
        color: #495057;
        padding: 4px;
      }

      .duration-parts {
        display: flex;
        gap: 2px;
        align-items: baseline;
      }

      .duration-number {
        font-weight: bold;
        color: #007bff;
      }

      .duration-unit {
        font-size: 11px;
        color: #6c757d;
        text-transform: lowercase;
      }

      .duration-compact {
        font-size: 11px;
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
      const duration = this.parseDuration(this.data);
      if (!duration) {
        return html`<div class="duration-container">-</div>`;
      }

      return html`
        <div class="duration-container">
          <div class="duration-parts">
            ${this.renderDurationParts(duration)}
          </div>
        </div>
      `;
    }

    parseDuration(value) {
      if (typeof value !== 'number' || value < 0) {
        return null;
      }

      // Assume value is in seconds, but handle milliseconds if > 1e10
      let seconds = value;
      if (value > 1e10) {
        // Likely milliseconds
        seconds = value / 1000;
      }

      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      return { days, hours, minutes, seconds: secs };
    }

    renderDurationParts(duration) {
      const parts = [];

      if (duration.days > 0) {
        parts.push(html`<span class="duration-number">${duration.days}</span><span class="duration-unit">d</span>`);
      }
      if (duration.hours > 0 || parts.length > 0) {
        parts.push(html`<span class="duration-number">${duration.hours}</span><span class="duration-unit">h</span>`);
      }
      if (duration.minutes > 0 || parts.length > 0) {
        parts.push(html`<span class="duration-number">${duration.minutes}</span><span class="duration-unit">m</span>`);
      }
      if (duration.seconds > 0 || parts.length === 0) {
        parts.push(html`<span class="duration-number">${duration.seconds}</span><span class="duration-unit">s</span>`);
      }

      return parts;
    }

    getCopyText() {
      const duration = this.parseDuration(this.data);
      if (!duration) return '0s';

      let text = '';
      if (duration.days > 0) text += `${duration.days}d `;
      if (duration.hours > 0) text += `${duration.hours}h `;
      if (duration.minutes > 0) text += `${duration.minutes}m `;
      text += `${duration.seconds}s`;

      return text.trim();
    }

    getCopyHTML() {
      return `<div>${this.getCopyText()}</div>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy duration',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        },
        {
          text: 'copy seconds',
          action: () => {
            navigator.clipboard.writeText(`${this.data || 0}`);
          }
        }
      ];
    }
  }

customElements.define('widget-duration', DurationWidget);