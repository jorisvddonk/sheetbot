import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class VideoWidget extends LitElement {
    static styles = css`
      .video-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      }

      video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 8px;
      }

      .video-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 14px;
        text-align: center;
        padding: 20px;
      }

      .play-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
        color: #333;
        margin-bottom: 10px;
        transition: all 0.2s ease;
      }

      .play-button:hover {
        background: rgba(255, 255, 255, 1);
        transform: scale(1.1);
      }

      .video-info {
        font-size: 12px;
        color: #999;
        margin-top: 5px;
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .video-placeholder {
          color: #ccc;
        }

        .play-button {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .play-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .video-info {
          color: #888;
        }
      }
    `;

    static properties = {
      data: {type: String},
      autoplay: {type: Boolean},
      controls: {type: Boolean},
      muted: {type: Boolean},
    };

    constructor() {
      super();
      this.data = '';
      this.autoplay = false;
      this.controls = true;
      this.muted = false;
    }

    render() {
      if (!this.data || this.data.trim() === '') {
        return html`
          <div class="video-container">
            <div class="video-placeholder">
              <button class="play-button" disabled>▶</button>
              <div>No video URL provided</div>
            </div>
          </div>
        `;
      }

      const videoUrl = this.data.trim();
      const isValidUrl = this.isValidUrl(videoUrl);

      if (!isValidUrl) {
        return html`
          <div class="video-container">
            <div class="video-placeholder">
              <button class="play-button" disabled>▶</button>
              <div>Invalid video URL</div>
              <div class="video-info">${videoUrl}</div>
            </div>
          </div>
        `;
      }

      return html`
        <div class="video-container">
          <video
            src="${videoUrl}"
            ?autoplay="${this.autoplay}"
            ?controls="${this.controls}"
            ?muted="${this.muted}"
            preload="metadata"
            @error="${this.onVideoError}"
          >
            Your browser does not support the video tag.
          </video>
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

    onVideoError(e) {
      console.error('Video load error:', e);
      // Could show an error state here
    }

    getCopyText() {
      return this.data || '';
    }

    getCopyHTML() {
      return `<video src="${this.data}" controls></video>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy video URL',
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

customElements.define('widget-video', VideoWidget);