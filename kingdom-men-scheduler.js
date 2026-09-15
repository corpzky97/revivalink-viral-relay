// Kingdom Men Hawaii Telegram daily scheduler.
// Loaded with NODE_OPTIONS=--require ./kingdom-men-scheduler.js so secrets remain in Render env.

const BOT_USERNAME = "KingdomMenHawaiiDailyBot";
const TZ = "Pacific/Honolulu";
let lastSentDate = "";
let running = false;

const devotionals = [
  {
    ref: "Joshua 1:9",
    verse: "Be strong and of good courage; do not be afraid, nor be dismayed, for the LORD your God is with you wherever you go.",
    title: "COURAGE FOR THE CALL",
    article: "A Kingdom man is not defined by the absence of pressure, but by obedience in the middle of it. God did not promise Joshua an easy road; He promised His presence. Today, lead your home, work, ministry, and decisions from that reality. Courage grows when we remember Who goes with us.",
    prayer: "Father, strengthen every Kingdom man today. Give us courage to obey You, wisdom to lead well, and faith to move forward without fear. In Jesus’ name, amen."
  },
  {
    ref: "Proverbs 27:17",
    verse: "As iron sharpens iron, so a man sharpens the countenance of his friend.",
    title: "MEN WHO SHARPEN MEN",
    article: "Isolation weakens men, but godly brotherhood strengthens them. Kingdom men need brothers who will pray, encourage, correct, and stand with them. Be intentional today: strengthen another man, speak life, and refuse shallow relationships. Healthy brotherhood produces stronger husbands, fathers, leaders, and disciples.",
    prayer: "Lord, build genuine brotherhood among us. Make us men who encourage, sharpen, protect, and strengthen one another in Christ. Amen."
  },
  {
    ref: "Micah 6:8",
    verse: "He has shown you, O man, what is good; and what does the LORD require of you but to do justly, to love mercy, and to walk humbly with your God?",
    title: "THE CHARACTER OF A KINGDOM MAN",
    article: "Kingdom leadership begins with character. Before God enlarges influence, He forms integrity. Strength without humility becomes pride; conviction without mercy becomes harshness. Walk closely with God today, do what is right even when no one is watching, and let mercy shape the way you lead people.",
    prayer: "Father, form Christlike character in us. Teach us to walk in justice, mercy, humility, and integrity before You. Amen."
  },
  {
    ref: "Ephesians 6:10",
    verse: "Finally, my brethren, be strong in the Lord and in the power of His might.",
    title: "STRENGTH THAT COMES FROM GOD",
    article: "A man can be physically strong and still spiritually exhausted. Kingdom strength does not come from personality, position, or willpower. It comes from abiding in Christ. Before you carry today’s responsibilities, receive strength from the Lord. Pray first. Listen first. Let His power govern your response to pressure.",
    prayer: "Lord, we refuse to rely only on our own strength. Fill us with Your Spirit and empower us to stand, lead, serve, and overcome today. Amen."
  },
  {
    ref: "1 Corinthians 16:13–14",
    verse: "Watch, stand fast in the faith, be brave, be strong. Let all that you do be done with love.",
    title: "STRONG AND LOVING",
    article: "Biblical strength is never separated from love. Kingdom men stand firm in truth while carrying the heart of Christ. Be courageous without becoming hard. Be decisive without becoming controlling. Let your strength protect, serve, build, and bless the people God has entrusted to you.",
    prayer: "Jesus, make us strong in faith and rich in love. Let our words, decisions, and leadership reflect Your heart today. Amen."
  },
  {
    ref: "Psalm 1:2–3",
    verse: "His delight is in the law of the LORD, and in His law he meditates day and night. He shall be like a tree planted by the rivers of water.",
    title: "ROOTED BEFORE FRUITFUL",
    article: "A fruitful life is built on hidden roots. Before visible success comes private devotion, obedience, and consistency in God’s Word. Do not measure your spiritual life only by activity. Ask whether your roots are deep. A Kingdom man who stays planted in God can remain steady through changing seasons.",
    prayer: "Father, root us deeply in Your Word. Make our lives stable, fruitful, and faithful in every season. Amen."
  },
  {
    ref: "Mark 10:45",
    verse: "For even the Son of Man did not come to be served, but to serve, and to give His life a ransom for many.",
    title: "LEADERSHIP THAT SERVES",
    article: "Jesus redefined greatness. Kingdom leadership is not about demanding attention; it is about carrying responsibility for others. Look for someone you can serve today—at home, at work, in church, or in the community. The strongest men are secure enough to kneel, serve, and lift others.",
    prayer: "Lord Jesus, give us servant hearts. Remove pride and make our leadership a reflection of Your humility, courage, and love. Amen."
  }
];

function hawaiiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const out = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    date: `${out.year}-${out.month}-${out.day}`,
    hour: Number(out.hour),
    minute: Number(out.minute)
  };
}

function devotionalForDate(dateString) {
  const n = Number(dateString.replace(/-/g, ""));
  return devotionals[n % devotionals.length];
}

function formatMessage(d) {
  return [
    "⚔️ KINGDOM MEN HAWAII — DAILY WORD",
    "",
    `📖 ${d.ref}`,
    `“${d.verse}”`,
    "",
    `🔥 ${d.title}`,
    "",
    d.article,
    "",
    "🙏 PRAYER & DECLARATION",
    d.prayer,
    "",
    "💬 Brotherhood Challenge: Share one takeaway or prayer request in the group today.",
    "",
    "#KingdomMenHawaii #MenOfGod #Faith #Brotherhood"
  ].join("\n");
}

async function telegram(method, body) {
  const token = process.env.KINGDOM_MEN_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("token_missing");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(`telegram_${data.error_code || r.status}`);
  return data.result;
}

async function sendDaily(reason = "scheduled") {
  if (running) return false;
  running = true;
  try {
    const chatId = process.env.KINGDOM_MEN_TELEGRAM_CHAT_ID;
    if (!chatId) throw new Error("chat_id_missing");
    const bot = await telegram("getMe", {});
    if (bot.username !== BOT_USERNAME) throw new Error("wrong_bot");
    const hp = hawaiiParts();
    const d = devotionalForDate(hp.date);
    await telegram("sendMessage", {
      chat_id: chatId,
      text: formatMessage(d),
      disable_web_page_preview: true
    });
    lastSentDate = hp.date;
    console.log(`[Kingdom Men] Daily Telegram post sent (${reason}) for ${hp.date} Hawaii.`);
    return true;
  } catch (err) {
    console.log(`[Kingdom Men] Daily Telegram send failed: ${err.message}`);
    return false;
  } finally {
    running = false;
  }
}

async function tick() {
  const hp = hawaiiParts();
  if (hp.hour === 7 && hp.minute <= 4 && lastSentDate !== hp.date) {
    await sendDaily("7am_hawaii");
  }
}

// One controlled test on startup when explicitly enabled in Render.
if (process.env.KINGDOM_MEN_TEST_ON_START === "1") {
  setTimeout(() => sendDaily("startup_test"), 5000);
}

setInterval(tick, 30000);
setTimeout(tick, 10000);

module.exports = { sendDaily, hawaiiParts };
