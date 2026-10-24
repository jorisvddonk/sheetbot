# Getting started

This tutorial installs SheetBot locally, creates a login, and starts the server. It takes a few minutes.

## Prerequisites

- **Node.js 22.6 or newer** — check with `node --version`.
- **npm** — installed with Node.js.
- **git** — to clone the repository.
- **Deno** (optional) — only needed for Deno-based agent scripts.

## 1. Clone and install

```bash
git clone https://github.com/jorisvddonk/sheetbot
cd sheetbot
npm install
```

## 2. Create a user

SheetBot stores users in `users.db`. Create your first user with:

```bash
npm run adduser
```

Choose a username and password. When asked for permissions, enter `*` to grant full access for local development.

## 3. Start the server

```bash
npm start
```

SheetBot listens on <http://localhost:3000/> by default. Open that URL and log in with the user you just created.

The first start also creates `tasks.db`, `secret.txt`, and the `artefacts/` directory. These files are gitignored.

## 4. Run an agent

Tasks are executed by agents, not by the server itself. In a second terminal, export your credentials and start the Node.js agent:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.js" | node
```

The Node.js agent polls once and exits. Run it in a loop, or schedule it with your operating system, if you want it to keep picking up tasks. See [Setting up other agents](setting-up-other-agents.md) for Deno, Python, and Bash agents.

## Next

Continue to [Your first task](your-first-task.md) to create work for the agent.
