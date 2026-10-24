# Building a custom widget

Widgets render sheet cells. SheetBot ships with text, code, image, progress, metric, task, and other widgets, and automatically loads any `widget-*.js` file from its static directories.

In this tutorial you build a small `hello` widget, register it, and use it for a sheet column.

## 1. Create the widget

Create `static/widget-hello.js`:

```javascript
import { html, css, LitElement } from "https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js";

export class HelloWidget extends LitElement {
  static properties = {
    data: { type: String },
    rowkey: { type: String },
    column: { type: String },
  };

  static styles = css`
    span {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      background: #e8f4ff;
      color: #0b4f8a;
      font-weight: 600;
    }
  `;

  constructor() {
    super();
    this.data = "";
    this.rowkey = "";
    this.column = "";
  }

  render() {
    return html`<span>Hello, ${this.data || "world"}!</span>`;
  }

  getCopyText() {
    return `Hello, ${this.data || "world"}!`;
  }

  getCopyHTML() {
    return `<span>${this.getCopyText()}</span>`;
  }
}

customElements.define("widget-hello", HelloWidget);
```

Rules:

- The filename must start with `widget-` and end with `.js`.
- The custom element name must be `widget-<name>`, here `widget-hello`.
- `data` receives the cell value. `rowkey` and `column` are also set.
- `getCopyText()` is used for copy operations. `getCopyHTML()` and `getContextMenuDefinition()` are optional.
- If you implement `delete()`, the grid can call it for destructive context-menu actions.

## 2. Make SheetBot discover it

SheetBot exposes all discovered widgets at `/widgets.json` and imports them when a sheet page loads:

```bash
curl "$SHEETBOT_BASEURL/widgets.json"
```

The list is cached for five minutes by default. For development, disable the cache and restart SheetBot:

```bash
export SHEETBOT_WIDGET_CACHE_TTL=0
npm start
```

Alternatively, keep the default and wait for the cache to expire. A hard refresh in the browser also helps after changing a widget module.

## 3. Use the widget for a column

Use the `build-status` sheet from [Customizing your sheet](customizing-your-sheet.md), or any sheet with a text column. Set the column's `widgettype` to `hello`:

```bash
sqlite3 sheets/build-status.db \
  "UPDATE columnstructure SET widgettype = 'hello' WHERE name = 'name';"
```

Refresh <http://localhost:3000/sheet.html?sheet=build-status>. The `name` column now renders as `Hello, Linux x64!`, and the value is still copied as plain text.

If the column does not exist in `columnstructure`, add it first:

```sql
INSERT INTO columnstructure
  (name, widgettype, columnorder)
VALUES
  ('name', 'hello', 1);
```

## 4. Debug a widget

- **The widget does not appear** — check that the file is in `static/` (or a directory in `SHEETBOT_STATIC_SEARCH_PATHS`), starts with `widget-`, and ends with `.js`.
- **`/widgets.json` does not list it** — the cache may still hold the old list. Set `SHEETBOT_WIDGET_CACHE_TTL=0`, restart, or wait.
- **The cell is empty** — open the browser console. A failed dynamic import or a mismatched `customElements.define` name shows up there.
- **The column is missing** — `columnstructure` has no row for it, or the column does not exist in `data_view`.
- **Changes do not show** — hard refresh. ES modules are cached by the browser.

## Next

- [Widgets reference](../reference/widgets.md) — built-in widget types and the widget contract.
- [Customizing your sheet](customizing-your-sheet.md) — per-column widget configuration.
- [Static search paths](../how-to/configure-static-paths.md) — load widgets from outside `static/`.
