// One-time manual Kingdom Men Hawaii Telegram sender.
// This module does not schedule recurring delivery.

const BOT_USERNAME = "KingdomMenHawaiiDailyBot";

async function telegram(method, body = {}) {
  const token = process.env.KINGDOM_MEN_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("token_missing");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`telegram_${data.error_code || response.status}`);
  }
  return data.result;
}

async function telegramPhoto(chatId, caption, imageBytes) {
  const token = process.env.KINGDOM_MEN_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("token_missing");

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1024));
  form.append("photo", new Blob([imageBytes], { type: "image/jpeg" }), "kingdom-men-invite.jpg");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`telegram_${data.error_code || response.status}`);
  }
  return data.result;
}

function getImageBytes() {
  const count = Math.max(0, Math.min(20, Number(process.env.KINGDOM_MEN_IMAGE_CHUNK_COUNT || 0)));
  const parts = [];
  if (count) {
    for (let i = 1; i <= count; i++) {
      const v = process.env[`KINGDOM_MEN_IMAGE_B64_${i}`];
      if (!v) throw new Error(`image_chunk_${i}_missing`);
      parts.push(v);
    }
  } else {
    for (let i = 1; i <= 20; i++) {
      const v = process.env[`KINGDOM_MEN_IMAGE_B64_${i}`];
      if (!v) break;
      parts.push(v);
    }
  }
  if (!parts.length) return null;
  return Buffer.from(parts.join(""), "base64");
}

async function sendWelcome() {
  if (process.env.KINGDOM_MEN_WELCOME_ON_START !== "1") return;

  const chatId = process.env.KINGDOM_MEN_TELEGRAM_CHAT_ID;
  const text = String(process.env.KINGDOM_MEN_ONE_TIME_MESSAGE || "").trim();

  if (!chatId) throw new Error("chat_id_missing");
  if (!text) throw new Error("message_missing");

  const bot = await telegram("getMe");
  if (bot.username !== BOT_USERNAME) throw new Error("wrong_bot");

  const imageBytes = getImageBytes();
  if (imageBytes) {
    await telegramPhoto(chatId, text, imageBytes);
    console.log("[Kingdom Men] One-time image post sent to the verified Telegram group.");
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    });
    console.log("[Kingdom Men] One-time text post sent to the verified Telegram group.");
  }
}

setTimeout(() => {
  sendWelcome().catch(err => {
    console.log(`[Kingdom Men] One-time send failed: ${err.message}`);
  });
}, 6000);
