import { css, LitElement, createRef, ref, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class GridElement extends LitElement {
    static properties = {
        data: { type: String }
    };

    constructor() {
        super();
    }

    contextMenuRef = createRef();


    createRenderRoot() {
        return this; // allow css to leak in
    }

    unselectAll() {
        document.querySelectorAll(`.grid .cell[selected]`).forEach(elem => {
            elem.removeAttribute("selected");
        });
    }
    downgradePreviousSelected() {
        document.querySelectorAll(`.grid .cell[selected="2"]`).forEach(elem => {
            elem.setAttribute("selected", 1);
        });
    }

    copySelectionToClipboard() {
        const selection = Array.from(document.querySelectorAll(`.grid .cell[selected]`));
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
            document.querySelectorAll(`.grid .cell[selected] > *`).forEach(elem => {
                if (typeof elem.delete === 'function') {
                    elem.delete();
                }
            });
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
            let rowAdd = 0;
            let colAdd = 0;
            if (event.key === "ArrowDown") {
                rowAdd += 1;
            }
            if (event.key === "ArrowUp") {
                rowAdd -= 1;
            }
            if (event.key === "ArrowLeft") {
                colAdd -= 1;
            }
            if (event.key === "ArrowRight") {
                colAdd += 1;
            }
            const curElem = document.querySelector(`.grid .cell[selected="2"]`);
            const elem = document.querySelector(`.grid .cell[row="${parseInt(curElem.getAttribute("row")) + rowAdd}"][col="${parseInt(curElem.getAttribute("col")) + colAdd}"]`);
            if (elem) {
                curElem.removeAttribute("selected");
                elem.setAttribute("selected", 2);
                elem.scrollIntoViewIfNeeded();
                event.preventDefault();
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
        const prevElem = document.querySelector(`.grid .cell[selected="2"]`);
        
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
            document.querySelectorAll(`.cell`).forEach(elem => {
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

    contextCell(rowindex, columnindex, event, tdElement) {
        if (event.shiftKey) {
            return;
        }
        const elem = tdElement.firstElementChild;
        if (typeof elem.getContextMenuDefinition === 'function' && typeof this.contextMenuRef.value.setItems === 'function') {
            event.preventDefault();
            this.contextMenuRef.value.setItems(elem.getContextMenuDefinition());
            this.contextMenuRef.value.style.top = event.clientY;
            this.contextMenuRef.value.style.left = event.clientX;
            this.contextMenuRef.value.style.position = "fixed";
            if (typeof this.contextMenuRef.value.show  === 'function') {
                this.contextMenuRef.value.show();
            }
            return false;
        }
    }

    tableGenerator(tabledef) {
        return html`
            <div class="grid">
                ${tabledef.columns.map((column, columnindex) => {
                    return html`<div class="cell header" style="grid-column: ${columnindex + 1}; grid-row: 1" col="${columnindex}" @click="${event => this.selectColumn(columnindex, event)}">
                        <span>${column.name}</span>
                    </div>`;
                })}
                ${tabledef.data.map((row, rowindex) => {
                    return html`
                    ${row.map((cell, columnindex) => {
                            function generateElement(widgettype) {
                                let elem = document.createElement(`widget-${widgettype}`);
                                elem.setAttribute("rowkey", row[0]);
                                elem.setAttribute("style", `overflow: auto; display: inline-block; position: relative; width: 100%; height: 100%;`);
                                elem.style.gridRow = rowindex + 2; // header is row 1!
                                elem.style.gridColumn = columnindex + 1;
                                const coldef = tabledef.columns[columnindex];
                                if (coldef.maxwidth !== undefined) {
                                    elem.style.maxWidth = coldef.maxwidth + "px";
                                }
                                if (coldef.minwidth !== undefined) {
                                    elem.style.minWidth = coldef.minwidth + "px";
                                }
                                if (coldef.maxheight !== undefined) {
                                    elem.style.maxHeight = coldef.maxheight + "px";
                                }
                                if (coldef.minheight !== undefined) {
                                    elem.style.minHeight = coldef.minheight + "px";
                                }
                                if (cell === null) {
                                    elem.setAttribute('data', null);
                                    elem.setAttribute('datatype', 'null');
                                } else if (cell === undefined) {
                                    elem.setAttribute('data', undefined);
                                    elem.setAttribute('datatype', 'undefined');
                                } else if (typeof cell === "object") {
                                    elem.setAttribute('data', JSON.stringify(cell, null, 2));
                                    if (Array.isArray(cell)) {
                                        elem.setAttribute('datatype', 'array');
                                    } else {
                                        elem.setAttribute('datatype', 'object');
                                    }
                                } else {
                                    elem.setAttribute('data', cell);
                                    if (Number.isFinite(cell)) {
                                        elem.setAttribute('datatype', 'number');
                                    } else if (typeof cell === 'string') {
                                        elem.setAttribute('datatype', 'string');
                                    } else if (typeof cell === 'boolean') {
                                        elem.setAttribute('datatype', 'boolean');
                                    }
                                }
                                return elem;
                            }
                            let elem;
                            const widgettype = tabledef.columns[columnindex].widgettype;
                            if (Array.isArray(widgettype)) {
                                // we have multiple widgets, slot them all into the first!
                                elem = generateElement(widgettype[0]);
                                elem.setAttribute("numslots", widgettype.length - 1);
                                let innerHTML = "";
                                for (let i = 1; i < widgettype.length; i++) {
                                    innerHTML = innerHTML + `<div slot="${i}">${generateElement(widgettype[i]).outerHTML}</div>`;
                                }
                                elem.innerHTML = innerHTML;
                            } else {
                                elem = generateElement(widgettype);
                            }
                            const tdref = createRef();
                            return html`
                                <div class="cell ${rowindex % 2 === 0 ? 'row-even' : 'row-odd'}" ${ref(tdref)} col="${columnindex}" row="${rowindex}" @mousedown="${event => {
                                    if (event.button === 0) {
                                        this.selectCell(rowindex, columnindex, event, tdref.value)
                                    }
                                }}" @contextmenu="${event => this.contextCell(rowindex, columnindex, event, tdref.value)}">${elem}</div>
                            `
                        })}`;
                })}
            </div>
        `;
    }
    
    render() {
        if (this.data !== null && this.data !== undefined) {
            return html`<span>${this.tableGenerator(JSON.parse(this.data))}<span><element-contextmenu ${ref(this.contextMenuRef)}/></span></span>`;
        }
        return html`<div></div>`;
    }
}

customElements.define('element-grid', GridElement);