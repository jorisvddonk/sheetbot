import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class MetricWidget extends LitElement {
    static styles = css`
      .metric-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .metric-value {
        font-size: 24px;
        font-weight: bold;
        margin: 0;
        line-height: 1;
      }

      .metric-unit {
        font-size: 12px;
        opacity: 0.9;
        margin-top: 2px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .metric-label {
        font-size: 10px;
        opacity: 0.8;
        margin-top: 4px;
        text-align: center;
      }

      /* Size variants */
      .metric-container.small {
        padding: 4px;
      }

      .metric-container.small .metric-value {
        font-size: 18px;
      }

      .metric-container.small .metric-unit {
        font-size: 10px;
      }

      .metric-container.small .metric-label {
        font-size: 9px;
      }

      .metric-container.large {
        padding: 12px;
      }

      .metric-container.large .metric-value {
        font-size: 32px;
      }

      .metric-container.large .metric-unit {
        font-size: 14px;
      }

      /* Color variants */
      .metric-container.success {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      }

      .metric-container.warning {
        background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
      }

      .metric-container.error {
        background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
      }

      .metric-container.info {
        background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .metric-container {
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      }
    `;

    static properties = {
      data: {type: Object},
      size: {type: String},
      color: {type: String},
    };

    constructor() {
      super();
      this.data = { value: 0, unit: '', label: '' };
      this.size = 'medium'; // small, medium, large
      this.color = 'primary'; // primary, success, warning, error, info
    }

    render() {
      const data = this.parseData(this.data);
      const classes = `metric-container ${this.size} ${this.color}`;

      return html`
        <div class="${classes}">
          <div class="metric-value">${this.formatValue(data.value)}</div>
          ${data.unit ? html`<div class="metric-unit">${data.unit}</div>` : ''}
          ${data.label ? html`<div class="metric-label">${data.label}</div>` : ''}
        </div>
      `;
    }

    parseData(data) {
      // Handle different input formats
      if (typeof data === 'number') {
        return { value: data, unit: '', label: '' };
      }

      if (typeof data === 'string') {
        // Try to parse as "value unit" or just "value"
        const parts = data.trim().split(/\s+/);
        if (parts.length >= 2) {
          const value = parseFloat(parts[0]);
          const unit = parts.slice(1).join(' ');
          return { value: isNaN(value) ? 0 : value, unit, label: '' };
        }
        const value = parseFloat(data);
        return { value: isNaN(value) ? 0 : value, unit: '', label: '' };
      }

      if (typeof data === 'object' && data !== null) {
        return {
          value: data.value || 0,
          unit: data.unit || '',
          label: data.label || ''
        };
      }

      return { value: 0, unit: '', label: '' };
    }

    formatValue(value) {
      // Don't apply K/M/B formatting if we already have meaningful units
      // Only format raw numbers without units
      const data = this.parseData(this.data);
      if (data.unit && this.hasMeaningfulUnit(data.unit)) {
        // For meaningful units like MB, GB, %, just show the number
        return Number.isInteger(value) ? value.toString() : value.toFixed(1);
      }

      // For raw numbers, apply K/M/B formatting
      if (value >= 1000000000) {
        return (value / 1000000000).toFixed(1) + 'B';
      }
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }

      // Format as integer if it's a whole number, otherwise show decimals
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }

    hasMeaningfulUnit(unit) {
      const meaningfulUnits = ['B', 'KB', 'MB', 'GB', 'TB', '%', 'ms', 's', 'm', 'h', 'd'];
      const upperUnit = unit.toUpperCase();
      return meaningfulUnits.some(u => upperUnit.includes(u));
    }

    getCopyText() {
      const data = this.parseData(this.data);
      let text = this.formatValue(data.value);
      if (data.unit) text += ' ' + data.unit;
      return text;
    }

    getCopyHTML() {
      return `<div>${this.getCopyText()}</div>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy value',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        }
      ];
    }
  }

customElements.define('widget-metric', MetricWidget);