# Customizing your sheet

In this tutorial you choose a widget for each column of the `build-status` sheet created in [Working with sheets](working-with-sheets.md).

Sheet widgets are configured per column in the `columnstructure` table inside the sheet's SQLite database. The web UI reads `columnstructure_view`, a read-only view that joins `columnstructure` with the actual columns of `data_view`.

## 1. Open the sheet database

The sheet database is a normal SQLite file:

```bash
sqlite3 sheets/build-status.db
```

Turn on readable output and allow the CLI to read the view. `columnstructure_view` uses `pragma_table_info`, which the `sqlite3` CLI blocks by default:

```sql
.headers on
.mode column
PRAGMA trusted_schema = ON;
SELECT name, widgettype, columnorder, datatype FROM columnstructure_view;
```

A new sheet has one wildcard row named `%` with the `text` widget. That fallback matches every column, which is why the sheet currently renders everything as text.

## 2. Replace the wildcard with explicit columns

Delete the wildcard and insert one row per column. `columnorder` controls display order; lower numbers appear first.

```sql
BEGIN;

DELETE FROM columnstructure;

INSERT INTO columnstructure
  (name, widgettype, minwidth, maxwidth, minheight, maxheight, columnorder)
VALUES
  ('key',        'text',               120, 220,  40,  80, 0),
  ('name',       'text',               160, 320,  40,  80, 1),
  ('status',     'taskstatus',         120, 200,  40,  80, 2),
  ('progress',   'progress',           160, 260,  40,  80, 3),
  ('updated_at', 'relative-timestamp', 160, 260,  40,  80, 4),
  ('notes',      'code',               240, 520, 100, 240, 5);

COMMIT;
```

Verify the result:

```sql
SELECT name, widgettype, columnorder, datatype FROM columnstructure_view;
```

Refresh <http://localhost:3000/sheet.html?sheet=build-status>. The sheet now renders:

| Column | Widget | Why |
|---|---|---|
| `key` | `text` | Plain row identifier |
| `name` | `text` | Plain build name |
| `status` | `taskstatus` | Renders status `0`–`4` as awaiting/running/completed/failed/paused |
| `progress` | `progress` | Renders a percentage bar from `0`–`100` |
| `updated_at` | `relative-timestamp` | Renders a millisecond timestamp as “2m ago” |
| `notes` | `code` | Monospace, syntax-highlighted text |

## 3. Change a widget later

Update the matching row in `columnstructure`:

```sql
UPDATE columnstructure
SET widgettype = 'text-centered'
WHERE name = 'name';
```

Refresh the sheet to see the change. To hide a column from the UI, delete its row; the data stays in the `data` table.

## How the views fit together

- **`data`** is the writable table. Tasks and the API write here.
- **`data_view`** is what the UI reads. By default it is `SELECT * FROM data`; you can replace it with a filtered or computed view.
- **`columnstructure`** is the writable widget configuration.
- **`columnstructure_view`** is the read-only join the UI reads. It combines `columnstructure` with `pragma_table_info('data_view')`, so it only includes columns that exist in `data_view`.

If a task later adds a new column and it does not appear in the sheet, add a matching `columnstructure` row for it. If you customize `data_view` to add computed columns, add `columnstructure` rows for those columns too.

## Next

- Browse all widget types in [Widgets](../reference/widgets.md).
- Read the full storage layout in [Sheet database](../reference/sheet-database.md).
- Learn how tasks write data in [Data management](../reference/data-management.md).
