# Widgets

SheetBot provides a variety of customizable widgets for displaying data in sheet cells. Widgets determine how data is rendered and interacted with in the web interface.

You can preview all available widgets by visiting the 'Help' page in SheetBot's web interface, which includes a comprehensive widget gallery with examples.

## Setting Up Widgets

Widgets are configured in a sheet's `columnstructure` table. Each column specifies:

- `widgettype`: The widget name (e.g., "text", "image")
- `minwidth`/`maxwidth`: Width constraints
- `minheight`/`maxheight`: Height constraints
- `columnorder`: Display order
- `datatype`: Data type hint

For multi-widgets, `widgettype` can be an array like `["multi", "text", "code"]`.

## UI Interaction

Widgets are displayed in an HTML table interface that supports advanced interaction:

- **Navigation**: Use arrow keys to navigate between cells
- **Selection**: Click and drag to select multiple cells, or hold Shift while clicking to select ranges
- **Copying**: Press Ctrl+C to copy selected cells to clipboard. Copies the underlying data as plain text (tab-separated) or HTML table format, not the visual representation
- **Multi-widgets**: Right-click on cells with multiple widgets to access a context menu for switching between widget views (e.g., switching a script column from hash image to text display)

## Text Widgets

Basic text display and formatting widgets.

- **`text`**: Plain text display
- **`text-centered`**: Centered text display

## Code & Data Widgets

Widgets for displaying code, JSON data, and structured information.

- **`code`**: Syntax-highlighted code blocks
- **`json-viewer`**: Interactive JSON viewer with collapsible structure

## Media & File Widgets

Widgets for images, downloads, and file-related content.

- **`image`**: Image rendering with size constraints
- **`download`**: Downloadable file links
- **`hashimg`**: Images generated from hash values
- **`video`**: Video player for media URLs
- **`audio`**: Audio player for media URLs

## Task & Status Widgets

Widgets for displaying task information and status indicators.

- **`taskstatus`**: Task status display (AWAITING, RUNNING, etc.)
- **`taskid`**: Task ID display
- **`taskname`**: Task name display
- **`tasktype`**: Task type display

## Time & Progress Widgets

Widgets for time display, progress tracking, and duration formatting.

- **`timestamp`**: Unix timestamp to human-readable time
- **`relative-timestamp`**: Time relative to now (e.g., "2 hours ago")
- **`progress`**: Progress bar (0-100)
- **`duration`**: Duration in seconds to formatted time
- **`metric`**: Numeric metric with unit and label

## Rating & Quality Widgets

Widgets for ratings, test results, and quality indicators.

- **`rating`**: Star rating display (0-5)
- **`testresult`**: Test result indicator (PASS/FAIL)

## Schema & Validation Widgets

Widgets for JSON Schema display, validation, and explanation.

- **`jsonschema`**: JSON Schema visualization
- **`jsonschema-validation`**: Schema validation results
- **`jsonschema-explanation`**: Schema documentation

## Interactive & Utility Widgets

Interactive buttons, multi-widgets, utility components, and QR codes.

- **`sheetkey`**: Sheet key display
- **`schedule-task`**: Button to schedule tasks
- **`multi`**: Multiple widgets in one cell (specify array of widget types)
- **`transitions`**: Task transitions display
- **`qr-code`**: QR code generation from text

## Creating Custom Widgets

To create a custom widget:

1. Add `widget-<name>.js` in `static/`
2. Define a class extending `HTMLElement`
3. Implement required methods: `getCopyText()`, `getCopyHTML()`, `getContextMenuDefinition()`, `delete()`
4. Register with `customElements.define('widget-<name>', WidgetClass)`
5. Load in `sheet.html` with `<script src="widget-<name>.js" type="module"></script>`
6. Set `widgettype = '<name>'` in `columnstructure`

See existing widgets in `static/` for examples.