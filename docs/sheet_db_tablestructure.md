# Sheet Database Table Structure

Sheets in SheetBot are stored as individual SQLite database files in the `./sheets/` directory. Each sheet contains several tables and views that manage data storage and presentation.

## Core Tables

### `data` Table

The main data storage table. Structure:

- `key` TEXT PRIMARY KEY - Unique identifier for each row

Additional columns are added dynamically as data is inserted. Column types are inferred automatically:
- Objects and booleans → TEXT (JSON-encoded)
- Numbers → INTEGER or REAL
- Strings → TEXT

Example schema after some inserts:
```sql
CREATE TABLE "data" (
    key TEXT PRIMARY KEY,
    name TEXT,
    age INTEGER,
    active TEXT,  -- JSON-encoded boolean
    metadata TEXT -- JSON-encoded object
);
```

### `columnstructure` Table

Defines metadata for each column in the data table, controlling how data is displayed in the web interface.

Columns:
- `name` TEXT PRIMARY KEY - Column name (must match a column in the data table)
- `widgettype` TEXT - Widget type for rendering (see [Widgets documentation](widgets.md))
- `minwidth` INTEGER - Minimum width in pixels
- `maxwidth` INTEGER - Maximum width in pixels
- `minheight` INTEGER - Minimum height in pixels
- `maxheight` INTEGER - Maximum height in pixels
- `columnorder` INTEGER UNIQUE - Display order (lower numbers appear first)

Example:
```sql
INSERT INTO "columnstructure" (name, widgettype, minwidth, maxwidth, minheight, maxheight, columnorder)
VALUES ('name', 'text', 100, 300, 50, 100, 1);
```

## Views

### `data_view` View

A customizable view of the data table. Initially defined as:
```sql
CREATE VIEW "data_view" AS SELECT * FROM "data";
```

Users can modify this view to transform data before display (e.g., add computed columns, filter rows).

### `columnstructure_view` View

Combines column structure metadata with actual table schema information:
```sql
CREATE VIEW "columnstructure_view" AS
SELECT p.name, c.widgettype, c.minwidth, c.maxwidth, c.minheight, c.maxheight,
       (ROW_NUMBER() OVER(ORDER BY c.columnorder)) - 1 AS columnorder,
       p.type as 'datatype'
FROM "columnstructure" c
JOIN pragma_table_info('data_view') p ON p.name LIKE c.name
ORDER BY c.columnorder ASC;
```

This view provides:
- Column metadata from `columnstructure`
- Actual SQLite datatype from table schema
- Zero-based column ordering for the UI

## Default Initialization

When a new sheet is created:

1. `data` table is created with only the `key` column
2. `data_view` is created as `SELECT * FROM "data"`
3. `columnstructure` table is created
4. A default entry for the `key` column is inserted with `widgettype = 'text'`
5. `columnstructure_view` is created

## Dynamic Schema

Sheets support dynamic schema evolution:
- New columns are added automatically when data with unknown fields is inserted
- Column types are inferred from the data values
- The `columnstructure` table can be updated to customize display without changing the data schema

This allows flexible data storage while maintaining structured presentation through the columnstructure metadata.