# signal40

Monitors a Solana account for token transfers via Helius WebSocket and sends alerts to a Telegram group.

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `HELIUS_API_KEY` | API key from [helius.dev](https://www.helius.dev/) |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Chat/group ID (negative number for groups) |

To get your chat ID: add the bot to your group, send a message, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and look for the `chat.id` field.

3. Run locally:

```bash
bun src/index.ts
```

## Telegram webhook

After deploying, set the webhook so the bot can respond to `/status` commands:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/webhook
```

## Deploy to Railway

1. Push this repo to GitHub
2. Connect the repo in [Railway](https://railway.app/)
3. Add your env vars in the Railway dashboard
4. Set the Telegram webhook to your Railway domain

To share: others can fork the repo, deploy to their own Railway account, and set their own env vars.
