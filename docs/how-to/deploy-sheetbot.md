# Deploy SheetBot

This guide covers running SheetBot as a long-lived service, putting it behind TLS, and backing up its data. The examples assume Linux with systemd; a launchd example for macOS follows.

## 1. Prepare the install

Create a dedicated user and directory:

```bash
sudo useradd --system --home /opt/sheetbot --shell /usr/sbin/nologin sheetbot
sudo mkdir -p /opt/sheetbot
sudo chown sheetbot:sheetbot /opt/sheetbot
```

Install as the service user:

```bash
sudo -u sheetbot git clone https://github.com/jorisvddonk/sheetbot /opt/sheetbot
cd /opt/sheetbot
sudo -u sheetbot npm ci --omit=dev
```

SheetBot needs Node.js 22.6 or newer. `npm ci --omit=dev` is enough at runtime; TypeScript is only used for development type checks.

The working directory holds persistent state:

- `users.db`, `tasks.db`, `sheet_permissions.db`
- `sheets/*.db`
- `artefacts/`
- `secret.txt`
- `key.pem`, `cert.pem` if using built-in HTTPS
- `init/`

Keep these writable by the service user and out of version control.

## 2. Configure environment

Create `/etc/sheetbot/sheetbot.env`:

```bash
NODE_ENV=production
SHEETBOT_PORT=3000
```

Restrict it:

```bash
sudo install -d -m 750 /etc/sheetbot
sudo chown root:sheetbot /etc/sheetbot
sudo chmod 640 /etc/sheetbot/sheetbot.env
```

Add any [environment variables](../reference/environment-variables.md) you need, such as search paths or `SHEETBOT_WIDGET_CACHE_TTL`.

## 3. Run with systemd

Create `/etc/systemd/system/sheetbot.service`:

```ini
[Unit]
Description=SheetBot
After=network.target

[Service]
Type=simple
User=sheetbot
Group=sheetbot
WorkingDirectory=/opt/sheetbot
EnvironmentFile=/etc/sheetbot/sheetbot.env
ExecStart=/usr/bin/node --experimental-sqlite --experimental-strip-types main.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust the Node path (`command -v node`). Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sheetbot
sudo systemctl status sheetbot
journalctl -u sheetbot -f
```

Check it locally:

```bash
curl -fsS http://127.0.0.1:3000/ >/dev/null && echo ok
```

## 4. Run with launchd on macOS

Create `~/Library/LaunchAgents/local.sheetbot.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.sheetbot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>--experimental-sqlite</string>
    <string>--experimental-strip-types</string>
    <string>main.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/opt/sheetbot</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>SHEETBOT_PORT</key>
    <string>3000</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/sheetbot.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/sheetbot.err.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.sheetbot.plist
launchctl kickstart -k gui/$(id -u)/local.sheetbot
```

Adjust the Node path for Intel Homebrew (`/usr/local/bin/node`) or your Node installation.

## 5. Put TLS in front

SheetBot listens on all interfaces. For a public deployment, bind it behind a reverse proxy and a firewall rather than exposing port 3000 directly.

Example Nginx site:

```nginx
server {
    listen 443 ssl http2;
    server_name sheetbot.example.com;

    ssl_certificate     /etc/letsencrypt/live/sheetbot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sheetbot.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location = /events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

SheetBot trusts forwarded headers, so `req.protocol` and generated agent/artefact URLs use `https` when `X-Forwarded-Proto` is set.

Alternatively, use the built-in HTTPS server. Put `key.pem` and `cert.pem` in the working directory; SheetBot starts HTTPS on `SHEETBOT_HTTPS_PORT` (default 443):

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem -out cert.pem -days 365 \
  -subj "/CN=sheetbot.local"
```

A self-signed certificate is fine for testing but not for public clients. A reverse proxy with Let's Encrypt is usually simpler. Binding port 443 as a non-root user requires extra privileges; use a high port behind a proxy or grant the capability explicitly.

## 6. Back up

Back up the SQLite files with `.backup` while the service is running, and copy artefacts:

```bash
BACKUP="/backup/sheetbot-$(date +%F-%H%M)"
mkdir -p "$BACKUP/sheets"

sqlite3 tasks.db ".backup '$BACKUP/tasks.db'"
sqlite3 users.db ".backup '$BACKUP/users.db'"

[ -f sheet_permissions.db ] && \
  sqlite3 sheet_permissions.db ".backup '$BACKUP/sheet_permissions.db'"

for db in sheets/*.db; do
  [ -e "$db" ] || continue
  sqlite3 "$db" ".backup '$BACKUP/sheets/$(basename "$db")'"
done

cp -a artefacts "$BACKUP/artefacts"

for file in secret.txt key.pem cert.pem; do
  [ -e "$file" ] && cp -a "$file" "$BACKUP/"
done
```

Back up `/etc/sheetbot/sheetbot.env` separately if it contains deployment settings. Do not put API keys or passwords in a world-readable backup.

## 7. Restore

Stop the service, replace the data, fix ownership, and start:

```bash
sudo systemctl stop sheetbot

cp -a "$BACKUP/tasks.db" "$BACKUP/users.db" /opt/sheetbot/
[ -f "$BACKUP/sheet_permissions.db" ] && \
  cp -a "$BACKUP/sheet_permissions.db" /opt/sheetbot/
cp -a "$BACKUP/sheets/." /opt/sheetbot/sheets/
cp -a "$BACKUP/artefacts/." /opt/sheetbot/artefacts/

sudo chown -R sheetbot:sheetbot /opt/sheetbot
sudo systemctl start sheetbot
```

For launchd, use `launchctl bootout`/`bootstrap` around the same file operations.

## 8. Upgrade

```bash
sudo systemctl stop sheetbot
sudo -u sheetbot git -C /opt/sheetbot pull
cd /opt/sheetbot
sudo -u sheetbot npm ci --omit=dev
sudo systemctl start sheetbot
```

Back up first. Schema migrations run automatically on startup.

## Security notes

- Run as an unprivileged user.
- Do not expose `users.db`, `tasks.db`, `sheets/`, or `artefacts/` through the reverse proxy.
- Use scoped API keys for agents; see [Using API keys for agents](../tutorials/using-api-keys-for-agents.md).
- Public sheets and the public artefact bucket are readable by anyone. Never publish secrets.
- Agent tasks execute arbitrary code by design. Run agents on machines you are willing to trust.

## Next

- [Environment variables](../reference/environment-variables.md) — every deployment setting.
- [Manage API keys](../how-to/manage-api-keys.md) — credentials for remote agents.
- [Debug a failed task](debug-failed-tasks.md) — diagnose an unhealthy deployment.
