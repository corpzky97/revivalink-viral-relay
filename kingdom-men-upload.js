// Secure one-time photo relay for Kingdom Men Hawaii Telegram.
// Allows an authenticated caller to upload a small image in URL-safe chunks,
// then send it to the configured Telegram group using the bot token held in Render.

const expressPath = require.resolve("express");
const originalExpress = require("express");
const uploads = new Map();

function authOk(req) {
  const expected = String(process.env.KINGDOM_MEN_MANUAL_POST_TOKEN || "");
  const provided = String(req.query.token || "");
  return Boolean(expected) && provided === expected;
}

async function telegramPhoto(chatId, caption, imageBytes) {
  const token = process.env.KINGDOM_MEN_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("token_missing");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", String(caption || "").slice(0, 1024));
  form.append("photo", new Blob([imageBytes], { type: "image/jpeg" }), "kingdom-men-invite.jpg");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const safe = String(data?.description || "unknown").replace(/https?:\/\/\S+/g, "[url]").slice(0, 160);
    throw new Error(`telegram_${data.error_code || response.status}_${safe}`);
  }
  return data.result;
}

function wrappedExpress(...args) {
  const app = originalExpress(...args);

  app.get("/api/kingdom-men/photo-chunk", (req, res) => {
    if (!authOk(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
    const id = String(req.query.id || "invite").slice(0, 40);
    const index = Number(req.query.i);
    const total = Number(req.query.total);
    const data = String(req.query.data || "");
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(total) || total < 1 || total > 40 || !data) {
      return res.status(400).json({ ok: false, error: "invalid_chunk" });
    }
    const record = uploads.get(id) || { total, parts: new Array(total) };
    if (record.total !== total) return res.status(409).json({ ok: false, error: "total_mismatch" });
    record.parts[index] = data;
    uploads.set(id, record);
    const received = record.parts.filter(Boolean).length;
    return res.json({ ok: true, id, index, received, total });
  });

  app.get("/api/kingdom-men/photo-send", async (req, res) => {
    if (!authOk(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
    try {
      const id = String(req.query.id || "invite").slice(0, 40);
      const record = uploads.get(id);
      if (!record || record.parts.filter(Boolean).length !== record.total) {
        return res.status(409).json({ ok: false, error: "incomplete_upload" });
      }
      const bytes = Buffer.from(record.parts.join(""), "base64url");
      if (bytes.length < 1000 || bytes.length > 5 * 1024 * 1024) {
        return res.status(400).json({ ok: false, error: "invalid_image_size" });
      }
      const chatId = process.env.KINGDOM_MEN_TELEGRAM_CHAT_ID;
      if (!chatId) throw new Error("chat_id_missing");
      const caption = String(process.env.KINGDOM_MEN_ONE_TIME_MESSAGE || "Kingdom Men Hawaii").trim();
      const sent = await telegramPhoto(chatId, caption, bytes);
      uploads.delete(id);
      console.log(`[Kingdom Men] Manual photo post sent. message_id=${sent?.message_id || "unknown"}`);
      return res.json({ ok: true, sent: true, message_id: sent?.message_id || null });
    } catch (err) {
      console.log(`[Kingdom Men] Manual photo post failed: ${err.message}`);
      return res.status(502).json({ ok: false, error: err.message });
    }
  });

  return app;
}

Object.assign(wrappedExpress, originalExpress);
require.cache[expressPath].exports = wrappedExpress;
