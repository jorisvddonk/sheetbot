import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class QrCodeWidget extends LitElement {
    static styles = css`
      .qr-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .qr-image {
        max-width: 100%;
        max-height: 100%;
        border-radius: 4px;
        background: white;
        padding: 5px;
        display: none;
      }

      .qr-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.8);
        text-align: center;
        font-size: 12px;
      }

      .qr-icon {
        font-size: 24px;
        margin-bottom: 5px;
        opacity: 0.7;
      }

      .qr-text {
        font-size: 10px;
        opacity: 0.6;
        margin-top: 5px;
        word-break: break-all;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .qr-container {
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      }
    `;

    static properties = {
      data: {type: String},
      size: {type: Number},
      errorCorrectionLevel: {type: String},
    };

    constructor() {
      super();
      this.data = '';
      this.size = 128;
      this.errorCorrectionLevel = 'M'; // L, M, Q, H
    }

    firstUpdated() {
      this.generateQR();
    }

    updated(changedProperties) {
      if (changedProperties.has('data') || changedProperties.has('size')) {
        this.generateQR();
      }
    }

    generateQR() {
      const img = this.shadowRoot.querySelector('img');
      if (!img) return;

      if (!this.data || this.data.trim() === '') {
        img.src = '';
        img.style.display = 'none';
        return;
      }

      // Use qr-server.com service for QR code generation
      const encodedData = encodeURIComponent(this.data.trim());
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${this.size}x${this.size}&data=${encodedData}&format=png`;

      img.src = qrUrl;
      img.style.display = 'block';
      img.onerror = () => {
        console.error('QR Code generation failed');
        img.style.display = 'none';
      };
    }

    render() {
      if (!this.data || this.data.trim() === '') {
        return html`
          <div class="qr-container">
            <div class="qr-placeholder">
              <div class="qr-icon">📱</div>
              <div>No data for QR code</div>
              <div class="qr-text">Provide text or URL</div>
            </div>
          </div>
        `;
      }

      return html`
        <div class="qr-container">
          <img class="qr-image" alt="QR Code" />
          <div class="qr-text">${this.data.length > 50 ? this.data.substring(0, 47) + '...' : this.data}</div>
        </div>
      `;
    }

    getCopyText() {
      return this.data || '';
    }

    getCopyHTML() {
      const img = this.shadowRoot.querySelector('img');
      return img && img.src ? `<img src="${img.src}" alt="QR Code">` : '';
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy QR text',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        },
        {
          text: 'copy QR image URL',
          action: () => {
            const img = this.shadowRoot.querySelector('img');
            if (img && img.src) {
              navigator.clipboard.writeText(img.src);
            }
          }
        }
      ];
    }
  }

customElements.define('widget-qr-code', QrCodeWidget);