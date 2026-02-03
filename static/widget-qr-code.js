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

      .qr-canvas {
        max-width: 100%;
        max-height: 100%;
        border-radius: 4px;
        background: white;
        padding: 5px;
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
      const canvas = this.shadowRoot.querySelector('canvas');
      if (!canvas) {
        console.error('Canvas not found');
        return;
      }

      const ctx = canvas.getContext('2d');
      const data = this.data.trim();

      console.log('Generating QR for:', data);
      console.log('Canvas element:', canvas);
      console.log('QRCode available:', typeof globalThis.QRCode);

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!data) {
        console.log('No data provided');
        return;
      }

      try {
        // Check if qrcode-generator library is loaded
        if (typeof globalThis.qrcode === 'undefined') {
          console.error('qrcode-generator library failed to load');
          ctx.fillStyle = '#ff6b6b';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('QR Library', canvas.width / 2, canvas.height / 2 - 15);
          ctx.fillText('Not Loaded', canvas.width / 2, canvas.height / 2);
          ctx.font = '10px monospace';
          ctx.fillText('Check console for details', canvas.width / 2, canvas.height / 2 + 15);
          return;
        }

        console.log('Generating QR code with qrcode-generator...');

        // Create QR code with qrcode-generator
        const qr = globalThis.qrcode(0, 'M'); // Type 0 (auto), Error correction 'M'
        qr.addData(data);
        qr.make();

        // Get the QR code matrix
        const size = qr.getModuleCount();
        const moduleSize = this.size / size;

        // Clear canvas and draw QR code
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, this.size, this.size);

        ctx.fillStyle = '#000000';
        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(
                col * moduleSize,
                row * moduleSize,
                moduleSize,
                moduleSize
              );
            }
          }
        }

        console.log('QR code generated successfully with qrcode-generator');
        console.log('QR Code generated successfully');
      } catch (error) {
        console.error('QR Code generation failed:', error);
        // Show error message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR Error', canvas.width / 2, canvas.height / 2);
      }
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
          <canvas class="qr-canvas" width="${this.size}" height="${this.size}"></canvas>
          <div class="qr-text">${this.data.length > 50 ? this.data.substring(0, 47) + '...' : this.data}</div>
        </div>
      `;
    }

    getCopyText() {
      return this.data || '';
    }

    getCopyHTML() {
      const canvas = this.shadowRoot.querySelector('canvas');
      return canvas ? `<img src="${canvas.toDataURL('image/png')}" alt="QR Code" width="${this.size}" height="${this.size}">` : '';
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
          text: 'copy QR image',
          action: () => {
            try {
              const canvas = this.shadowRoot.querySelector('canvas');
              if (canvas) {
                canvas.toBlob(async (blob) => {
                  await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                  ]);
                });
              }
            } catch (error) {
              console.error('Failed to copy QR image:', error);
              // Fallback: copy data URL
              const canvas = this.shadowRoot.querySelector('canvas');
              if (canvas) {
                navigator.clipboard.writeText(canvas.toDataURL('image/png'));
              }
            }
          }
        }
      ];
    }
  }

customElements.define('widget-qr-code', QrCodeWidget);