import {html, css, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class AttachmentsWidget extends LitElement {
    static styles = css`
        .attachments {
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 100%;
            font-size: 11px;
            font-family: sans-serif;
        }

        .attachment {
            display: flex;
            align-items: center;
            padding: 2px 4px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 2px;
            text-decoration: none;
            color: inherit;
            overflow: hidden;
        }

        .attachment:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .attachment-icon {
            flex-shrink: 0;
            margin-right: 4px;
            width: 12px;
            height: 12px;
        }

        .attachment-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        @media (prefers-color-scheme: dark) {
            .attachment {
                background: rgba(255, 255, 255, 0.1);
            }
            .attachment:hover {
                background: rgba(255, 255, 255, 0.2);
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
        this.rowkey = '';
    }

    getBaseUrl() {
        const params = new URL(document.URL).searchParams;
        const baseUrl = params.get('baseurl');
        if (baseUrl) {
            return baseUrl;
        }
        return window.location.origin;
    }

    getAttachmentUrl(filename) {
        return `${this.getBaseUrl()}/tasks/${this.rowkey}/artefacts/${filename}`;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const iconMap = {
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📽️', 'pptx': '📽️',
            'txt': '📃',
            'md': '📋',
            'zip': '📦', 'tar': '📦', 'gz': '📦', 'rar': '📦',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️', 'webp': '🖼️',
            'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵',
            'mp4': '🎬', 'webm': '🎬', 'mov': '🎬',
            'js': '📜', 'ts': '📜', 'py': '📜', 'rs': '📜', 'go': '📜',
            'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
            'html': '🌐', 'css': '🎨',
            'exe': '⚙️', 'bin': '⚙️', 'sh': '⚙️',
        };
        return iconMap[ext] || '📎';
    }

    render() {
        let artefacts = [];
        try {
            artefacts = JSON.parse(this.data);
        } catch (e) {
            if (this.data && this.data !== 'null') {
                artefacts = [this.data];
            }
        }

        if (!Array.isArray(artefacts) || artefacts.length === 0) {
            return html`<div class="attachments"></div>`;
        }

        return html`
            <div class="attachments">
                ${artefacts.map(filename => {
                    const url = this.getAttachmentUrl(filename);
                    return html`
                        <a class="attachment" href="${url}" target="_blank" title="${filename}">
                            <span class="attachment-icon">${this.getFileIcon(filename)}</span>
                            <span class="attachment-name">${filename}</span>
                        </a>
                    `;
                })}
            </div>
        `;
    }

    getCopyText() {
        try {
            const artefacts = JSON.parse(this.data);
            return artefacts.join(', ');
        } catch (e) {
            return this.data;
        }
    }

    getCopyHTML() {
        try {
            const artefacts = JSON.parse(this.data);
            const baseUrl = this.getBaseUrl();
            return artefacts.map(filename => 
                `<a href="${baseUrl}/tasks/${this.rowkey}/artefacts/${filename}" target="_blank">${filename}</a>`
            ).join('<br>');
        } catch (e) {
            return this.data;
        }
    }
}
customElements.define('widget-attachments', AttachmentsWidget);
