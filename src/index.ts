import { existsSync } from "node:fs";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const WATCHED_TOKEN = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const PORT = parseInt(process.env.PORT || "3000");
const DATA_FILE = "data/accounts.json";

// --- Account persistence ---

function loadAccounts(): Set<string> {
  return new Set(["5v7ZZg1D1si417WhUQF9Br2dRQEnd1sTbCfesscUCVKE",
                  "9UcygiamY92yGntGkUkBKi4SdApxkBMZd9QSo6wMC2dN",
                  "GhFaBi8sy3M5mgG97YguQ6J3f7XH4JwV5CoW8MbzRgAU",
                  "8m9THAPeXtJ7e1YJ43Dw4z4pHE9872o9WStgWoSQs2Ds",
                  "7TWnq4WeYcwQWBCwKeEX2Q9xqVtthPGkB7adNvueuVuh",
                  "6LY1JzAFVZsP2a2xKrtU6znQMQ5h4i7tocWdgrkZzkzF",
                  "9CKnC2kmqG9ZBtQXDfxR5H7Av7X878geV367DdYtybT4",
                  "8UHpWBnhYNeAQURWjAABp8vSrzfYa69o7sfi65vYLC42",
                  "3Z2AqcKCmdcCZ3iCUiFKtwUbrmuPcefwN3xRLTdY7XyN",
                 ]);
}

async function saveAccounts() {
  // accounts are managed in index.ts, no-op
}

const watchedAccounts = loadAccounts();

// --- State ---

let ws: WebSocket | null = null;
let wsConnected = false;
let lastTransferAt: Date | null = null;
const subscriptionIds = new Map<number, string>(); // sub id -> account
let nextReqId = 1;

// --- Telegram ---

async function sendTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    }),
  });
  if (!res.ok) {
    console.error("Telegram error:", await res.text());
  }
}

// --- WebSocket ---

const pendingSubscriptions = new Map<number, string>(); // req id -> account

function subscribeToAccount(socket: WebSocket, account: string) {
  const reqId = nextReqId++;
  pendingSubscriptions.set(reqId, account);
  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: reqId,
      method: "logsSubscribe",
      params: [{ mentions: [account] }, { commitment: "confirmed" }],
    }),
  );
  console.log(`Subscribing to ${account} (req ${reqId})`);
}

function unsubscribeFromAccount(socket: WebSocket, account: string) {
  for (const [subId, acct] of subscriptionIds) {
    if (acct === account) {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: nextReqId++,
          method: "logsUnsubscribe",
          params: [subId],
        }),
      );
      subscriptionIds.delete(subId);
      console.log(`Unsubscribed from ${account} (sub ${subId})`);
      return;
    }
  }
}

function connect() {
  console.log("Connecting to Helius WebSocket...");
  const socket = new WebSocket(HELIUS_WS_URL);

  socket.addEventListener("open", () => {
    wsConnected = true;
    ws = socket;
    subscriptionIds.clear();
    console.log(`Connected. Subscribing to ${watchedAccounts.size} account(s)...`);
    for (const account of watchedAccounts) {
      subscribeToAccount(socket, account);
    }
  });

  socket.addEventListener("message", async (event) => {
    const data = JSON.parse(String(event.data));

    // Subscription confirmation
    if (data.id && data.result !== undefined) {
      const account = pendingSubscriptions.get(data.id);
      if (account) {
        subscriptionIds.set(data.result, account);
        pendingSubscriptions.delete(data.id);
        console.log(`Subscribed to ${account} (sub ${data.result})`);
      }
      return;
    }

    const logs: string[] = data?.params?.result?.value?.logs ?? [];
    const signature: string = data?.params?.result?.value?.signature ?? "";
    const err = data?.params?.result?.value?.err;
    const subId: number = data?.params?.subscription;

    if (err) return;

    const involvesToken = logs.some((log: string) =>
      log.includes(WATCHED_TOKEN),
    );
    if (!involvesToken) return;

    const account = subscriptionIds.get(subId) ?? "unknown";
    lastTransferAt = new Date();
    console.log(`Detected transfer for ${account}: ${signature}`);

    const message =
      `<b>Transfer detected</b>\n` +
      `Account: <code>${account}</code>\n` +
      `Token: <code>${WATCHED_TOKEN}</code>\n` +
      `<a href="https://solscan.io/tx/${signature}">View on Solscan</a>`;

    await sendTelegram(message);
  });

  socket.addEventListener("close", () => {
    wsConnected = false;
    ws = null;
    console.log("WebSocket closed. Reconnecting in 5s...");
    setTimeout(connect, 5000);
  });

  socket.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
    socket.close();
  });
}

// --- Bot commands ---

async function handleCommand(text: string) {
  const [cmd, ...args] = text.split(" ");

  switch (cmd) {
    case "/status": {
      const uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const accountList = [...watchedAccounts]
        .map((a) => `  <code>${a}</code>`)
        .join("\n");
      const status = [
        `<b>signal40 status</b>`,
        `WebSocket: ${wsConnected ? "connected" : "disconnected"}`,
        `Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        `Last transfer: ${lastTransferAt ? lastTransferAt.toISOString() : "none yet"}`,
        ``,
        `<b>Watching ${watchedAccounts.size} account(s):</b>`,
        accountList || "  (none)",
      ].join("\n");
      await sendTelegram(status);
      break;
    }

    case "/add": {
      const address = args[0];
      if (!address) {
        await sendTelegram("Usage: /add &lt;solana address&gt;");
        return;
      }
      if (watchedAccounts.has(address)) {
        await sendTelegram(`Already watching <code>${address}</code>`);
        return;
      }
      watchedAccounts.add(address);
      await saveAccounts();
      if (ws && wsConnected) {
        subscribeToAccount(ws, address);
      }
      await sendTelegram(`Added <code>${address}</code>`);
      break;
    }

    case "/remove": {
      const address = args[0];
      if (!address) {
        await sendTelegram("Usage: /remove &lt;solana address&gt;");
        return;
      }
      if (!watchedAccounts.has(address)) {
        await sendTelegram(`Not watching <code>${address}</code>`);
        return;
      }
      watchedAccounts.delete(address);
      await saveAccounts();
      if (ws && wsConnected) {
        unsubscribeFromAccount(ws, address);
      }
      await sendTelegram(`Removed <code>${address}</code>`);
      break;
    }

    case "/list": {
      if (watchedAccounts.size === 0) {
        await sendTelegram("No accounts being watched.");
        return;
      }
      const list = [...watchedAccounts]
        .map((a) => `<code>${a}</code>`)
        .join("\n");
      await sendTelegram(`<b>Watched accounts:</b>\n${list}`);
      break;
    }
  }
}

// --- Startup ---

if (!HELIUS_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing required env vars. Check your .env file.");
  process.exit(1);
}

const startedAt = new Date();

Bun.serve({
  port: PORT,
  routes: {
    "/health": new Response("ok"),
    "/webhook": {
      POST: async (req) => {
        const update = (await req.json()) as any;
        const text: string = update?.message?.text ?? "";

        if (text) {
          await handleCommand(text);
        }

        return new Response("ok");
      },
    },
  },
});

console.log(`Starting signal40 (http on :${PORT})...`);
connect();
