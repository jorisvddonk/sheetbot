import { css, LitElement, createRef, ref, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TableElement extends LitElement {
    static properties = {
        data: { type: String }
    };

    constructor() {
        super();
    }


    createRenderRoot() {
        return this; // allow css to leak in
    }

    unselectAll() {
        document.querySelectorAll(`table td[selected]`).forEach(elem => {
            elem.removeAttribute("selected");
        });
    }
    downgradePreviousSelected() {
        document.querySelectorAll(`table td[selected="2"]`).forEach(elem => {
            elem.setAttribute("selected", 1);
        });
    }

    copySelectionToClipboard() {
        const selection = Array.from(document.querySelectorAll(`table td[selected]`));
        if (selection.length == 0) {
            return;
        }
        const minRow = selection.reduce((memo, elem) => {
            const row = parseInt(elem.getAttribute("row"), 10);
            return row < memo ? row : memo;
        }, Number.MAX_SAFE_INTEGER);
        const minCol = selection.reduce((memo, elem) => {
            const col = parseInt(elem.getAttribute("col"), 10);
            return col < memo ? col : memo;
        }, Number.MAX_SAFE_INTEGER);
        const maxRow = selection.reduce((memo, elem) => {
            const row = parseInt(elem.getAttribute("row"), 10);
            return row > memo ? row : memo;
        }, Number.MIN_SAFE_INTEGER);
        const maxCol = selection.reduce((memo, elem) => {
            const col = parseInt(elem.getAttribute("col"), 10);
            return col > memo ? col : memo;
        }, Number.MIN_SAFE_INTEGER);

        const emptyTableStruct = [...Array(maxRow - minRow + 1).keys()].map(r => {
            return [...Array(maxCol - minCol + 1).keys()].map(c => {
                return {
                    row: r + minRow,
                    col: c + minCol
                }
            });
        }); // array of arrays of {row: number, col: number}; will contain items that are NOT selected if there are gaps in the selection!

        const elementTableStruct = emptyTableStruct.map(rowarr => {
            return rowarr.map(cell => {
                return selection.find(elem => parseInt(elem.getAttribute("selected"), 10) > 0 && parseInt(elem.getAttribute("row"), 10) == cell.row && parseInt(elem.getAttribute("col"), 10) == cell.col);
            });
        }); // array of arrays of td elements; will contain undefined if there are gaps in the selection!

        const textTableStruct = elementTableStruct.map(rowarr => {
            return rowarr.map(tdElem => {
                if (tdElem !== undefined) {
                    const elem = tdElem.firstElementChild;
                    if (elem !== undefined) {
                        try {
                            return elem.getCopyText();
                        } catch (e) {
                            return elem.innerText; // may not work!
                        }
                    }
                }
                return '';
            })
        });

        const htmlTableStruct = elementTableStruct.map(rowarr => {
            return rowarr.map(tdElem => {
                if (tdElem !== undefined) {
                    const elem = tdElem.firstElementChild;
                    if (elem !== undefined) {
                        try {
                            return elem.getCopyHTML();
                        } catch (e) {
                            try {
                                return elem.getCopyText();
                            } catch (e) {
                                return elem.innerText; // may not work!
                            }
                        }
                    }
                }
                return '';
            })
        });

        let copyPlainText = '';
        textTableStruct.forEach(rowarr => {
            rowarr.forEach((celltext, index) => {
                copyPlainText += `${index > 0 ? '\t' : ''}${celltext}`;
            });
            copyPlainText += '\n';
        });

        let copyHTMLText = '<table><tbody>';
        htmlTableStruct.forEach(rowarr => {
            copyHTMLText += '<tr>';
            rowarr.forEach((celltext, index) => {
                copyHTMLText += `<td>${celltext}</td>`;
            });
            copyHTMLText += '</tr>';
        });
        copyHTMLText += "</tbody></table>";

        const data = [new ClipboardItem({
            ["text/plain"]: new Blob([copyPlainText], { type: "text/plain" }),
            ["text/html"]: new Blob([copyHTMLText], { type: "text/html" }),
        })];
        navigator.clipboard.write(data).then(
            () => {
                console.log("copy success")
            },
            () => {
                console.log("copy fail");
            }
        );
    }

    ondocumentKeyDown(event) {
        if (event.code === "KeyC" && event.ctrlKey === true) {
            event.preventDefault();
            this.copySelectionToClipboard();
        }
        if (event.key === "Delete") {
            const elem = document.querySelector(`table td[selected="2"] > *`);
            if (typeof elem.delete === 'function') {
                elem.delete();
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener("selectionchange", this.unselectAll.bind(this));
        document.addEventListener("keydown", this.ondocumentKeyDown.bind(this));
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("selectionchange", this.unselectAll.bind(this));
        document.removeEventListener("keydown", this.ondocumentKeyDown.bind(this));
    }

    selectColumn(columnindex, event) {
        if (event.detail == 2) {
            //const selection = document.getSelection();
            //selection.removeAllRanges();
            document.querySelectorAll(`td[col="${columnindex}"]`).forEach(elem => {
                //const range = document.createRange();
                //range.selectNode(elem);
                //selection.addRange(range);

                elem.setAttribute("selected", 1);
            });
        }
    }

    selectCell(rowindex, columnindex, event, element) {
        const prevElem = document.querySelector(`table td[selected="2"]`);
        
        if (event.ctrlKey === false) {
            this.unselectAll();
        } else {
            this.downgradePreviousSelected();
        }

        if (event.shiftKey) {
            const minRow = Math.min(parseInt(prevElem.getAttribute('row'), 10), parseInt(element.getAttribute('row'), 10));
            const minCol = Math.min(parseInt(prevElem.getAttribute('col'), 10), parseInt(element.getAttribute('col'), 10));
            const maxRow = Math.max(parseInt(prevElem.getAttribute('row'), 10), parseInt(element.getAttribute('row'), 10));
            const maxCol = Math.max(parseInt(prevElem.getAttribute('col'), 10), parseInt(element.getAttribute('col'), 10));
            document.querySelectorAll(`td`).forEach(elem => {
                const r = parseInt(elem.getAttribute('row'), 10);
                const c = parseInt(elem.getAttribute('col'), 10);
                if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
                    elem.setAttribute("selected", 1);
                }
            });
        }
        element.setAttribute("selected", 2);
        event.preventDefault();
    }

    tableGenerator(tabledef) {
        return html`
            <table><thead>
                <tr>${tabledef.columns.map((column, columnindex) => {
                    return html`<th col="${columnindex}" @click="${event => this.selectColumn(columnindex, event)}">
                        ${column.name}
                    </th>`;
                })}</tr>
            </thead>
            <tbody>
                ${tabledef.data.map((row, rowindex) => {
                    return html`<tr>
                    ${row.map((cell, columnindex) => {
                            const tdref = createRef();
                            let elem;
                            const widgettype = tabledef.columns[columnindex].widgettype;
                            switch (widgettype) {
                                default:
                                    elem = document.createElement(`widget-${widgettype}`);
                                    if (typeof cell === "object") {
                                        elem.setAttribute('data', JSON.stringify(cell, null, 2));
                                    } else {
                                        elem.setAttribute('data', cell);
                                    }
                                }
                            return html`
                                <td ${ref(tdref)} col="${columnindex}" row="${rowindex}" @mousedown="${event => this.selectCell(rowindex, columnindex, event, tdref.value)}">${elem}</td>
                            `
                        })}
                    </tr>`;
                })}
            </tbody></table>
        `;
    }
    
    render() {
        if (this.data !== null && this.data !== undefined) {
            return this.tableGenerator(JSON.parse(this.data));
        }
        return html`<div></div>`;
    }
}

customElements.define('element-table', TableElement);