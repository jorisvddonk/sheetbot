import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class RatingWidget extends LitElement {
    static styles = css`
      .rating-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 4px;
      }

      .star {
        font-size: 16px;
        color: #ffc107;
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));
        transition: all 0.2s ease;
      }

      .star.empty {
        color: #dee2e6;
      }

      .star.half {
        position: relative;
      }

      .star.half::after {
        content: '★';
        position: absolute;
        top: 0;
        left: 0;
        width: 50%;
        overflow: hidden;
        color: #ffc107;
      }

      .rating-text {
        margin-left: 8px;
        font-size: 12px;
        color: #6c757d;
        font-weight: 500;
      }

      .rating-container:hover .star {
        transform: scale(1.1);
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
      const rating = Math.max(0, Math.min(5, this.data || 0));
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

      return html`
        <div class="rating-container">
          ${Array.from({length: fullStars}, () => html`<span class="star">★</span>`)}
          ${hasHalfStar ? html`<span class="star half">★</span>` : ''}
          ${Array.from({length: emptyStars}, () => html`<span class="star empty">★</span>`)}
          <span class="rating-text">${rating.toFixed(1)}</span>
        </div>
      `;
    }

    getCopyText() {
      return `${this.data || 0}/5`;
    }

    getCopyHTML() {
      return `<div>${this.getCopyText()} ★★★★★</div>`;
    }

    getContextMenuDefinition() {
      return [
        {
          text: 'copy rating',
          action: () => {
            navigator.clipboard.writeText(this.getCopyText());
          }
        }
      ];
    }
  }

customElements.define('widget-rating', RatingWidget);