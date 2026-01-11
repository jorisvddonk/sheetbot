# SheetBot

- [Why I Built SheetBot](#why-i-built-sheetbot)
- [Philosophy](#philosophy)
- [AI Usage](#ai-usage)
- [Conceptual Architecture](#conceptual-architecture)
- [Features](#features)
- [Getting Started](#getting-started)
- [Known Issues](#known-issues)
- [Initialization](#initialization)
- [Scripts](#scripts)
- [Protocol and API](#protocol-and-api)
- [Data Management](#data-management)
- [Agent Workflow](#agent-workflow)
- [Programmability and Extensibility](#programmability-and-extensibility)
- [Project Structure](#project-structure)

<img src="static/logo.png" width="128px">

An open-source automation and CI tool built with Deno, Express.js, SQLite, Web Components (Lit), and JSON Schema. SheetBot provides flexible task orchestration and a widget-based UI for visualization, enabling cross-platform builds, remote installations, and bespoke automation without heavy dependencies.

**For a detailed human-written account of SheetBot's development and philosophy, see: https://mooses.nl/blog/sheetbot_opensource_release/**

## Why I Built SheetBot

I needed a quick build system for testing modifications to my projects across Linux, Windows, and MacOS. Existing open-source CI systems had too many dependencies, strong opinions on configuration, weak cross-platform support, and weren't designed for pet-like machines or extensibility through code. SheetBot solves these by using SQLite for storage, JSON Schema for task matching, and opaque scripts that can be written in any language.

## Philosophy

SheetBot embraces "primitive emergent architecture": simple primitives (tasks, schemas, widgets) that combine into powerful systems. It's designed for configuration as code, easy extensibility, and integration with diverse environments. Tasks are opaque to SheetBot, allowing scripts in any language with custom runners. The API is simple; add a new runner with a few hours of work or an AI prompt.

Built with familiar tools: Express, JSON Schema, SQLite and Web Components. No complex dependencies, no complex build tooling, no opinions on build scripts, just flexible automation and the ability to get started with a simple `git clone` and `deno run` command.

As much compute as possible is pushed out to the viewer side (the web UI) or build agents, and kept away from the server side so that the server is lightweight and doesn't need a lot of compute. For example, visualizations depicting which tasks can be ran by which agents is performed client-side in the UI.

SheetBot is unlikely to be as easy to learn and use compared to existing CI tools, but once you understand how it works and how things fit together, it should be far easier to modify it to suit your needs. For me personally, that has saved time in the long run.

## AI Usage

Much of the SheetBot codebase since March 2025 has been developed with assistance from AI tools like Claude Code, Amazon Q Developer CLI, and OpenCode. The project's architecture lends itself well to AI-assisted development, particularly for creating custom widgets and integrations. This approach has accelerated feature development and demonstrated the potential of configuration as code with extensible scripting languages.

If you prefer to work with code developed without AI influence, refer to [this commit](https://github.com/jorisvddonk/sheetbot/tree/981d46cef317bd1d1ba956c9fc7a1fabbbf54625) from before *any* AI tools were utilized. AI usage was minor (function-level only) after that commit until March 2025.

## Conceptual Architecture

<img src="docs/assets/conceptual_architecture_diagram.excalidraw.png">

## Features

- **Flexible Task Orchestration**: Tasks with arbitrary scripts matched to agents via JSON Schema capabilities
- **Distributed Runtime**: Agents poll for tasks based on type and capabilities (e.g., OS, memory, installed software)
- **Widget-Based UI**: HTML table interface with customizable widgets for data visualization (text, images, code, downloads). Supports keyboard navigation, multi-cell selection with click-and-drag, and copying selected cells to clipboard as text or HTML tables. Columns can display multiple widgets with right-click context menus to switch between views.
- **Opaque Scripts**: Run tasks in any language: Deno, Python, Bash, or custom runners
- **Dependency Management**: Tasks can depend on others which blocks them until the others complete
- **Artefacts & Data Storage**: File uploads and SQLite-backed sheets for persistent data
- **Transitions**: Automatable task status changes (e.g., auto-delete, periodic resets)
- **Cross-Platform**: Works on diverse hardware from Raspberry Pis to gaming handhelds
- **Extensibility**: Modify code for custom auth, endpoints, widgets, or task types

See [Distributed Runtime](docs/Distributed_Runtime.md) for info on an experimental distributed runtime system that's also included.

## Getting Started

1. Ensure Deno is [installed](https://docs.deno.com/runtime/getting_started/installation/), then clone this repository
2. Add a user via `deno run adduser.ts` - this will prompt you first for read and write access to files like the user database file; read through them and accept if you agree, then type in the username and password to generate a new user. Use `*` for permissions to give access to all features, or see [docs/permissions.md](docs/permissions.md) for more info on the permissions system.
3. Run the main server: `deno run --allow-read=./static --allow-read=./secret.txt --allow-read=./users.db --allow-write=./users.db --allow-read=./tasks.db --allow-write=./tasks.db --allow-read=./artefacts/ --allow-write=./artefacts/ --allow-read=./sheets/ --allow-write=./sheets/ --allow-read=./library/ --allow-read=./scripts/ --allow-read=./init/ main.ts` - this will again prompt for a few extra permissions; read through them and accept if you agree.
4. Access the web interface at http://localhost:3000/
5. To test SheetBot, go to the Library page and add the "Hello World" task.
6. Run an agent to execute the task:
   ```bash
   export SHEETBOT_AUTH_USER=your_username
   export SHEETBOT_AUTH_PASS=your_password
   export SHEETBOT_BASEURL=http://localhost:3000
   deno run --allow-net --allow-env --allow-read ${SHEETBOT_BASEURL}/scripts/agent.ts
   ```

By default, SheetBot listens on all interfaces (`0.0.0.0`) - change this in `main.ts` as needed.

## Known Issues

See [Known Issues](docs/known_issues.md) for current limitations and workarounds.

## Initialization

See [Initialization System](docs/init_system.md) for details on the startup initialization system that runs TypeScript scripts on every server startup.

## Scripts

- **`scripts/` directory**: Contains agent template files (`agent.template.ts`, `agent.template.py`, `agent.template.sh`)
- **`library/` directory**: Contains automation scripts for various use cases (game development, web deployment, system automation, etc.) - [See examples](library/README.md)

### Library Script Annotations

Library scripts use special XML-like annotations in comments to define task metadata. See [Library Script Annotations](docs/library_script_annotations.md) for details on how to use `<name>`, `<capabilitiesSchema>`, `<data>`, and `<addTaskComments>` annotations.

## Protocol and API

See [Protocol](docs/protocol.md) for task execution flows and [Artefacts](docs/artefacts.md) for artefact management.

## Data Management

See [Data Management](docs/data_management.md) for details on task data, dependency injection, sheet data, and sheet updates during tasks.

## Agent Workflow

See [Agent Workflow](docs/agent_workflow.md) for information on how agents poll for tasks and execute them using various runners.

## Programmability and Extensibility

See [Programmability](docs/programmability.md) for key extension points and how to customize SheetBot.

## Project Structure

- `lib/`: Core libraries and data providers
- `scripts/`: Agent template files
- `library/`: Automation scripts
- `sheets/`: Generated sheet files
- `static/`: Web assets and HTML files
- `docs/`: Documentation files
- `init/`: Initialization scripts that run on server startup
- `artefacts/`: File artefacts uploaded by tasks
- `adduser.ts`: Script to add users to the database
- `addtask.ts`: Script to add tasks programmatically
- `openapi.yaml`: OpenAPI specification for the API
- Database files: `users.db`, `tasks.db`, `secret.txt` (created on first run)