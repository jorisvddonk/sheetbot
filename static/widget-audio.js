import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class AudioWidget extends LitElement {
    static styles = css`
      .audio-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        padding: 15px;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      audio {
        width: 100%;
        margin-top: 10px;
        border-radius: 4px;
      }

      .audio-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .play-icon {
        font-size: 32px;
        margin-bottom: 8px;
        opacity: 0.8;
      }

      .audio-title {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 5px;
      }

      .audio-info {
        font-size: 12px;
        opacity: 0.8;
        margin-bottom: 10px;
      }

      .waveform-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 40px;
        margin: 10px 0;
        opacity: 0.6;
      }

      .waveform-bar {
        width: 3px;
        height: 20px;
        background: rgba(255, 255, 255, 0.5);
        margin: 0 1px;
        border-radius: 2px;
        animation: wave 1.5s ease-in-out infinite;
      }

      .waveform-bar:nth-child(2) { animation-delay: 0.1s; }
      .waveform-bar:nth-child(3) { animation-delay: 0.2s; }
      .waveform-bar:nth-child(4) { animation-delay: 0.3s; }
      .waveform-bar:nth-child(5) { animation-delay: 0.4s; }

      @keyframes wave {
        0%, 100% { height: 20px; opacity: 0.5; }
        50% { height: 35px; opacity: 1; }
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .audio-container {
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      }
    `;

    static properties = {
      data: {type: String},
      autoplay: {type: Boolean},
      controls: {type: Boolean},
      loop: {type: Boolean},
    };

    constructor() {
      super();
      this.data = '';
      this.autoplay = false;
      this.controls = true;
      this.loop = false;
    }

    render() {
      if (!this.data || this.data.trim() === '') {
        return html`
          <div class="audio-container">
            <div class="audio-placeholder">
              <div class="play-icon">🎵</div>
              <div class="audio-title">No Audio</div>
              <div class="audio-info">Provide an audio URL</div>
            </div>
          </div>
        `;
      }

      const audioUrl = this.data.trim();
      const isValidUrl = this.isValidUrl(audioUrl);
      const fileName = this.getFileName(audioUrl);

      if (!isValidUrl) {
        return html`
          <div class="audio-container">
            <div class="audio-placeholder">
              <div class="play-icon">⚠️</div>
              <div class="audio-title">Invalid URL</div>
              <div class="audio-info">${audioUrl}</div>
            </div>
          </div>
        `;
      }

      return html`
        <div class="audio-container">
          <div class="audio-placeholder">
            <div class="play-icon">🎵</div>
            <div class="audio-title">${fileName || 'Audio Track'}</div>
            <div class="waveform-placeholder">
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
            </div>
          </div>
          <audio
            src="${audioUrl}"
            ?autoplay="${this.autoplay}"
            ?controls="${this.controls}"
            ?loop="${this.loop}"
            preload="metadata"
            @error="${this.onAudioError}"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      `;
    }

    isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }

    getFileName(url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop();
        return fileName || null;
      } catch {
        return null;
      }
    }

    onAudioError(e) {
      console.error('Audio load error:', e);
    }

    getCopyText() {
      return this.data || '';
    }

    getCopyHTML() {
      return `<audio src="${this.data}" controls></audio>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy audio URL',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        },
        {
          text: 'open in new tab',
          action: () => {
            if (this.data) {
              globalThis.open(this.data, '_blank');
            }
          }
        }
      ];
    }
  }

customElements.define('widget-audio', AudioWidget);