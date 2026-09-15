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

async function verifyBot() {
  const bot = await telegram("getMe");
  if (bot.username !== BOT_USERNAME) throw new Error("wrong_bot");
  return bot;
}

async function sendShareLink(chatId) {
  const invite = await telegram("createChatInviteLink", {
    chat_id: chatId,
    name: "Kingdom Men Hawaii Share Link"
  });

  const text = [
    "🔗 SHARE KINGDOM MEN HAWAII",
    "",
    "Brothers, help us build the brotherhood. Invite men who desire to grow in Christ, strengthen their families, and walk with other godly men.",
    "",
    invite.invite_link,
    "",
    "Faith • Family • Brotherhood • Work • Legacy"
  ].join("\n");

  const sent = await telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });

  if (process.env.KINGDOM_MEN_SHARE_LINK_PIN === "1" && sent?.message_id) {
    await telegram("pinChatMessage", {
      chat_id: chatId,
      message_id: sent.message_id,
      disable_notification: true
    });
  }

  console.log(`[Kingdom Men] Share link created and posted: ${invite.invite_link}`);
}

async function runOneTimeActions() {
  const chatId = process.env.KINGDOM_MEN_TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("chat_id_missing");

  await verifyBot();

  if (process.env.KINGDOM_MEN_SHARE_LINK_ON_START === "1") {
    await sendShareLink(chatId);
  }

  if (process.env.KINGDOM_MEN_WELCOME_ON_START !== "1") return;

  const text = String(process.env.KINGDOM_MEN_ONE_TIME_MESSAGE || "").trim();
  if (!text) throw new Error("message_missing");

  const imageBytes = getImageBytes();
  let sent;
  if (imageBytes) {
    sent = await telegramPhoto(chatId, text, imageBytes);
    console.log("[Kingdom Men] One-time image post sent to the verified Telegram group.");
  } else {
    sent = await telegram("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    });
    console.log("[Kingdom Men] One-time text post sent to the verified Telegram group.");
  }

  if (process.env.KINGDOM_MEN_PIN_ON_START === "1" && sent?.message_id) {
    await telegram("pinChatMessage", {
      chat_id: chatId,
      message_id: sent.message_id,
      disable_notification: true
    });
    console.log("[Kingdom Men] One-time post pinned in the verified Telegram group.");
  }

  if (process.env.KINGDOM_MEN_POLL_ON_START === "1") {
    await telegram("sendPoll", {
      chat_id: chatId,
      question: "Which Kingdom Men resource would help you most right now?",
      options: [
        "Daily Word / Devotionals",
        "Marriage & Fatherhood",
        "Prayer & Spiritual Growth",
        "Jobs, Skills & Provision",
        "Men's Health & Fitness",
        "Brotherhood & Mentoring"
      ],
      is_anonymous: false,
      allows_multiple_answers: true
    });
    console.log("[Kingdom Men] Resource poll sent to the verified Telegram group.");
  }
}

setTimeout(() => {
  runOneTimeActions().catch(err => {
    console.log(`[Kingdom Men] One-time send failed: ${err.message}`);
  });
}, 6000);
