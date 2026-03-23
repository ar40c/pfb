const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

const WATCHED_ACCOUNT = "5v7ZZg1D1si417WhUQF9Br2dRQEnd1sTbCfesscUCVKE";
const WATCHED_TOKEN = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";

const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const PORT = parseInt(process.env.PORT || "3000");

let wsConnected = false;
let lastTransferAt: Date | null = null;

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

function connect() {
  console.log("Connecting to Helius WebSocket...");
  const ws = new WebSocket(HELIUS_WS_URL);

  ws.addEventListener("open", () => {
    wsConnected = true;
    console.log("Connected. Subscribing to logs for", WATCHED_ACCOUNT);
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [{ mentions: [WATCHED_ACCOUNT] }, { commitment: "confirmed" }],
      }),
    );
  });

  ws.addEventListener("message", async (event) => {
    const data = JSON.parse(String(event.data));

    // Subscription confirmation
    if (data.id === 1) {
      console.log("Subscribed, subscription id:", data.result);
      return;
    }

    const logs: string[] = data?.params?.result?.value?.logs ?? [];
    const signature: string = data?.params?.result?.value?.signature ?? "";
    const err = data?.params?.result?.value?.err;

    // Skip failed transactions
    if (err) return;

    const involvesToken = logs.some((log: string) =>
      log.includes(WATCHED_TOKEN),
    );
    if (!involvesToken) return;

    lastTransferAt = new Date();
    console.log("Detected transfer:", signature);

    const message =
      `<b>Transfer detected</b>\n` +
      `Account: <code>${WATCHED_ACCOUNT}</code>\n` +
      `Token: <code>${WATCHED_TOKEN}</code>\n` +
      `<a href="https://solscan.io/tx/${signature}">View on Solscan</a>`;

    await sendTelegram(message);
  });

  ws.addEventListener("close", () => {
    wsConnected = false;
    console.log("WebSocket closed. Reconnecting in 5s...");
    setTimeout(connect, 5000);
  });

  ws.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
    ws.close();
  });
}

// Verify env vars
if (!HELIUS_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing required env vars. Check your .env file.");
  process.exit(1);
}

// HTTP server for Telegram bot webhook + health check
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
          console.log(
            `Telegram message from ${update?.message?.from?.username ?? "unknown"}: ${text}`,
          );
        }

        if (text === "/status") {
          const uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
          const status = [
            `<b>signal40 status</b>`,
            `WebSocket: ${wsConnected ? "connected" : "disconnected"}`,
            `Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            `Last transfer: ${lastTransferAt ? lastTransferAt.toISOString() : "none yet"}`,
          ].join("\n");

          await sendTelegram(status);
        }

        return new Response("ok");
      },
    },
  },
});

console.log(`Starting signal40 (http on :${PORT})...`);
connect();
