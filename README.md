# SheetBot Internal

A TypeScript-based automation and task management system using Deno.

## Features

- Distributed runtime for executing tasks
- SQLite data providers for sheets and users
- Web interface for managing sheets and tasks
- Various utility scripts for different operations

## Getting Started

1. Ensure Deno is installed
2. Run the main server: `deno run --allow-all main.ts`
3. Access the web interface at the configured port

## Scripts

Various scripts are available in the `scripts/` directory for specific tasks like compilation, system operations, and examples.

## Project Structure

- `lib/`: Core libraries and data providers
- `scripts/`: Automation scripts
- `sheets/`: Generated sheet files
- `static/`: Web assets and HTML files