# signal40

Monitors Solana accounts for token transfers and sends real-time alerts to a Telegram group.

## Bot Commands

Once the bot is running in your Telegram group, you can use these commands:

| Command | Description |
|---|---|
| `/status` | Check if the bot is online, see uptime and watched accounts |
| `/add <address>` | Start watching a Solana account |
| `/remove <address>` | Stop watching a Solana account |
| `/list` | Show all currently watched accounts |

## Getting your own copy

1. Install [Git](https://git-scm.com/downloads) if you don't have it
2. Clone this repo:

```bash
git clone https://github.com/carpntr/signal40.git
cd signal40
```

3. Create your own repo on [GitHub](https://github.com/new) (name it whatever you like, set it to private)
4. Point your local copy to your new repo:

```bash
git remote set-url origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
git push
```

## Deploy to Railway

1. Sign up at [Railway](https://railway.app/) and create a new project from your GitHub repo
3. Add the following environment variables in the Railway dashboard:

| Variable | Description | How to get it |
|---|---|---|
| `HELIUS_API_KEY` | Solana RPC provider | Sign up at [helius.dev](https://www.helius.dev/) and copy your API key |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the prompts |
| `TELEGRAM_CHAT_ID` | The group chat to send alerts to | See [Getting your Chat ID](#getting-your-chat-id) below |
| `PORT` | Server port | Set to `3000` |

4. In Railway, go to **Settings → Networking → Public Networking** and generate a domain (use port `3000`)
5. Connect the Telegram webhook by visiting this URL in your browser (replace the placeholders):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_RAILWAY_DOMAIN>/webhook
```

You should see `{"ok":true}`. That's it — send `/status` in your group to verify.

### Persisting data across restarts

By default, the watched account list resets on each deploy. To keep it:

1. In Railway, go to **Settings → Volumes → Add Volume**
2. Set the mount path to `/data`
3. Choose 1 GB (the minimum — costs $0.25/month)

### Getting your Chat ID

1. Add your bot to the Telegram group
2. Go to **@BotFather → /mybots → your bot → Bot Settings → Group Privacy → Turn off**
3. Send any message in the group
4. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser
5. Look for `"chat":{"id":-100XXXXXXXXXX}` — that negative number is your chat ID

## Local Development

Requires [Bun](https://bun.sh/).

```bash
bun install
cp .env.example .env   # fill in your values
bun src/index.ts
```

Note: the `/status` and other bot commands only work when the Telegram webhook is pointed at your server. For local testing, you can use a tool like [ngrok](https://ngrok.com/) to expose your local server.
