// One-time Kingdom Men Hawaii purpose/rules post + pin.
// Safe to keep preloaded; it only runs when KINGDOM_MEN_PIN_RULES_ON_START=1.

const BOT_USERNAME = "KingdomMenHawaiiDailyBot";

const RULES_TEXT = `👑 KINGDOM MEN HAWAII — PURPOSE & GROUP RULES

PURPOSE / LAYUNIN
Kingdom Men Hawaii exists to help men grow deeper in Christ, become stronger husbands and fathers, build genuine brotherhood, lead with integrity, work with excellence, serve others, and leave a godly legacy.

Dito tayo para magpalakasan, manalangin sa isa’t isa, matuto sa Salita ng Diyos, at tulungan ang bawat kapatid sa spiritual at practical na buhay.

⚔️ FAITH • FAMILY • BROTHERHOOD • WORK • LEGACY

GROUP RULES / MGA ALITUNTUNIN

1️⃣ CHRIST-CENTERED & BIBLE-GROUNDED
Keep conversations honoring to Jesus and consistent with Scripture. We may disagree on secondary matters, but Christ remains the center.

2️⃣ RESPECT EVERY BROTHER
No insults, shaming, bullying, name-calling, gossip, or personal attacks. Correct with truth, humility, and love.

3️⃣ CONFIDENTIALITY MATTERS
What is shared in confidence stays in confidence. Do not repost prayer requests, family struggles, testimonies, photos, or private messages without permission.

4️⃣ BUILD, DON’T TEAR DOWN
Post things that encourage, teach, help, or strengthen men. Avoid unnecessary arguments, divisive debates, rumor-sharing, and inflammatory content.

5️⃣ PRAYER REQUESTS ARE WELCOME
Share your own needs freely. If the request involves another person, protect their privacy and avoid unnecessary identifying details unless they gave permission.

6️⃣ NO PORNOGRAPHIC, OBSCENE, OR SEXUALLY EXPLICIT CONTENT
Keep the group clean, honorable, and safe for Christian men of different ages and life stages.

7️⃣ NO SPAM, SCAMS, OR UNAPPROVED SELLING
No repeated promotions, fundraising, affiliate links, investment schemes, or business solicitation without admin approval. Jobs, services, and practical opportunities may be shared when genuine, transparent, and helpful.

8️⃣ POLITICS: NO CAMPAIGNING OR PARTISAN FIGHTS
Important civic matters may be discussed respectfully when relevant, but this group is not a political campaign space. Our unity in Christ comes first.

9️⃣ HELP WITH WISDOM & SAFETY
When giving advice about health, legal, financial, marriage, mental health, or emergencies, be responsible. Brotherhood support does not replace qualified professional or emergency help when needed.

🔟 ADMINS MAY MODERATE
Admins may remove harmful, deceptive, private, repetitive, inappropriate, or divisive posts and may privately contact members when needed to protect the community.

🤝 OUR BROTHERHOOD COMMITMENT
Pray for one another. Encourage one another. Tell the truth in love. Show up when a brother needs help. Honor your family. Work faithfully. Serve humbly. Follow Jesus.

“As iron sharpens iron, so a man sharpens the countenance of his friend.” — Proverbs 27:17

Welcome to Kingdom Men Hawaii. You do not have to walk alone.`;

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
  if (!response.ok || !data.ok) throw new Error(`telegram_${data.error_code || response.status}`);
  return data.result;
}

async function postAndPinRules() {
  if (process.env.KINGDOM_MEN_PIN_RULES_ON_START !== "1") return;
  const chatId = process.env.KINGDOM_MEN_TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("chat_id_missing");

  const bot = await telegram("getMe");
  if (bot.username !== BOT_USERNAME) throw new Error("wrong_bot");

  const sent = await telegram("sendMessage", {
    chat_id: chatId,
    text: RULES_TEXT,
    disable_web_page_preview: true
  });

  await telegram("pinChatMessage", {
    chat_id: chatId,
    message_id: sent.message_id,
    disable_notification: true
  });

  console.log("[Kingdom Men] Purpose and group rules posted and pinned successfully.");
}

setTimeout(() => {
  postAndPinRules().catch(err => {
    console.log(`[Kingdom Men] Rules post/pin failed: ${err.message}`);
  });
}, 8000);
