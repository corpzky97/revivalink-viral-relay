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
    tlTitle: "TAPANG PARA SA TAWAG NG DIYOS",
    article: "A Kingdom man is not defined by the absence of pressure, but by obedience in the middle of it. God did not promise Joshua an easy road; He promised His presence. Today, lead your home, work, ministry, and decisions from that reality. Courage grows when we remember Who goes with us.",
    tlArticle: "Ang Kingdom man ay hindi nasusukat sa kawalan ng pressure, kundi sa pagiging masunurin sa Diyos kahit may pressure. Hindi ipinangako ng Diyos kay Joshua ang madaling daan; ipinangako Niya ang Kanyang presensya. Ngayon, pangunahan ang tahanan, trabaho, ministry, at mga desisyon mula sa katotohanang kasama mo ang Diyos. Lumalakas ang tapang kapag naaalala natin kung Sino ang kasama natin.",
    prayer: "Father, strengthen every Kingdom man today. Give us courage to obey You, wisdom to lead well, and faith to move forward without fear. In Jesus’ name, amen.",
    tlPrayer: "Ama, palakasin Mo ang bawat Kingdom man ngayon. Bigyan Mo kami ng tapang na sumunod, karunungan na mamuno nang tama, at pananampalatayang magpatuloy nang walang takot. Sa pangalan ni Jesus, amen.",
    declaration: "God is with me. I will lead with courage and obedience.",
    tlDeclaration: "Kasama ko ang Diyos. Mamumuno ako nang may tapang at pagsunod."
  },
  {
    ref: "Proverbs 27:17",
    verse: "As iron sharpens iron, so a man sharpens the countenance of his friend.",
    title: "MEN WHO SHARPEN MEN",
    tlTitle: "MGA LALAKING NAGPAPATIBAY SA ISA'T ISA",
    article: "Isolation weakens men, but godly brotherhood strengthens them. Kingdom men need brothers who will pray, encourage, correct, and stand with them. Be intentional today: strengthen another man, speak life, and refuse shallow relationships. Healthy brotherhood produces stronger husbands, fathers, leaders, and disciples.",
    tlArticle: "Pinahihina ng isolation ang isang lalaki, pero pinalalakas siya ng makadiyos na brotherhood. Kailangan natin ng mga kapatid na mananalangin, magpapalakas, magtutuwid, at tatayo kasama natin. Ngayon, sadyain mong palakasin ang isang kapatid, magsalita ng buhay, at bumuo ng tunay na relasyon. Ang malusog na brotherhood ay humuhubog ng mas matatag na asawa, ama, lider, at alagad ni Cristo.",
    prayer: "Lord, build genuine brotherhood among us. Make us men who encourage, sharpen, protect, and strengthen one another in Christ. Amen.",
    tlPrayer: "Panginoon, bumuo Ka ng tunay na brotherhood sa amin. Gawin Mo kaming mga lalaking nagpapalakas, nagtutuwid sa pag-ibig, nag-iingat, at tumatayo para sa isa't isa kay Cristo. Amen.",
    declaration: "I will not walk alone. Godly brothers will strengthen me, and I will strengthen others.",
    tlDeclaration: "Hindi ako lalakad mag-isa. Palalakasin ako ng makadiyos na mga kapatid, at palalakasin ko rin sila."
  },
  {
    ref: "Micah 6:8",
    verse: "He has shown you, O man, what is good; and what does the LORD require of you but to do justly, to love mercy, and to walk humbly with your God?",
    title: "THE CHARACTER OF A KINGDOM MAN",
    tlTitle: "ANG KARAKTER NG KINGDOM MAN",
    article: "Kingdom leadership begins with character. Before God enlarges influence, He forms integrity. Strength without humility becomes pride; conviction without mercy becomes harshness. Walk closely with God today, do what is right even when no one is watching, and let mercy shape the way you lead people.",
    tlArticle: "Nagsisimula ang Kingdom leadership sa karakter. Bago palawakin ng Diyos ang ating influence, hinuhubog muna Niya ang ating integrity. Ang lakas na walang humility ay nagiging pride, at ang conviction na walang mercy ay nagiging harshness. Lumakad nang malapit sa Diyos, gawin ang tama kahit walang nakakakita, at hayaang ang awa ng Diyos ang humubog sa paraan ng iyong pamumuno.",
    prayer: "Father, form Christlike character in us. Teach us to walk in justice, mercy, humility, and integrity before You. Amen.",
    tlPrayer: "Ama, hubugin Mo sa amin ang karakter ni Cristo. Turuan Mo kaming lumakad sa katuwiran, awa, kababaang-loob, at integrity sa harapan Mo. Amen.",
    declaration: "My character will honor Christ in public and in private.",
    tlDeclaration: "Ang aking karakter ay magbibigay-puri kay Cristo sa harap ng tao at maging sa pribado."
  },
  {
    ref: "Ephesians 6:10",
    verse: "Finally, my brethren, be strong in the Lord and in the power of His might.",
    title: "STRENGTH THAT COMES FROM GOD",
    tlTitle: "LAKAS NA NAGMUMULA SA DIYOS",
    article: "A man can be physically strong and still spiritually exhausted. Kingdom strength does not come from personality, position, or willpower. It comes from abiding in Christ. Before you carry today’s responsibilities, receive strength from the Lord. Pray first. Listen first. Let His power govern your response to pressure.",
    tlArticle: "Maaaring malakas ang katawan ng isang lalaki pero pagod na pagod ang espiritu. Ang tunay na Kingdom strength ay hindi galing sa personality, posisyon, o sariling willpower. Nagmumula ito sa pananatili kay Cristo. Bago mo pasanin ang mga responsibilidad ngayon, tumanggap muna ng lakas mula sa Panginoon. Manalangin muna. Makinig muna. Hayaan ang Kanyang kapangyarihan ang mamahala sa iyong tugon sa pressure.",
    prayer: "Lord, we refuse to rely only on our own strength. Fill us with Your Spirit and empower us to stand, lead, serve, and overcome today. Amen.",
    tlPrayer: "Panginoon, ayaw naming umasa lamang sa sarili naming lakas. Puspusin Mo kami ng Iyong Espiritu at bigyan ng kapangyarihang tumayo, mamuno, maglingkod, at magtagumpay ngayon. Amen.",
    declaration: "My strength comes from the Lord, not from pressure or pride.",
    tlDeclaration: "Ang lakas ko ay nagmumula sa Panginoon, hindi sa pressure o pride."
  },
  {
    ref: "1 Corinthians 16:13–14",
    verse: "Watch, stand fast in the faith, be brave, be strong. Let all that you do be done with love.",
    title: "STRONG AND LOVING",
    tlTitle: "MATATAG AT PUNO NG PAG-IBIG",
    article: "Biblical strength is never separated from love. Kingdom men stand firm in truth while carrying the heart of Christ. Be courageous without becoming hard. Be decisive without becoming controlling. Let your strength protect, serve, build, and bless the people God has entrusted to you.",
    tlArticle: "Ang biblical strength ay hindi kailanman hiwalay sa pag-ibig. Ang Kingdom man ay matatag sa katotohanan habang dala ang puso ni Cristo. Maging matapang nang hindi nagiging matigas. Maging decisive nang hindi controlling. Hayaan ang iyong lakas ay magprotekta, maglingkod, magtayo, at magpala sa mga taong ipinagkatiwala sa iyo ng Diyos.",
    prayer: "Jesus, make us strong in faith and rich in love. Let our words, decisions, and leadership reflect Your heart today. Amen.",
    tlPrayer: "Jesus, gawin Mo kaming matatag sa pananampalataya at sagana sa pag-ibig. Nawa ang aming salita, desisyon, at pamumuno ay magpakita ng Iyong puso. Amen.",
    declaration: "I will stand firm in truth and lead with the love of Christ.",
    tlDeclaration: "Tatayo akong matatag sa katotohanan at mamumuno sa pag-ibig ni Cristo."
  },
  {
    ref: "Psalm 1:2–3",
    verse: "His delight is in the law of the LORD, and in His law he meditates day and night. He shall be like a tree planted by the rivers of water.",
    title: "ROOTED BEFORE FRUITFUL",
    tlTitle: "MAG-UGAT MUNA BAGO MAMUNGA",
    article: "A fruitful life is built on hidden roots. Before visible success comes private devotion, obedience, and consistency in God’s Word. Do not measure your spiritual life only by activity. Ask whether your roots are deep. A Kingdom man who stays planted in God can remain steady through changing seasons.",
    tlArticle: "Ang buhay na namumunga ay nagsisimula sa malalim na ugat na hindi nakikita. Bago ang visible success ay may private devotion, obedience, at consistency sa Salita ng Diyos. Huwag sukatin ang spiritual life sa dami lamang ng ginagawa. Tanungin kung malalim ba ang iyong ugat sa Diyos. Ang Kingdom man na nananatiling nakatanim sa Panginoon ay mananatiling matatag sa bawat season.",
    prayer: "Father, root us deeply in Your Word. Make our lives stable, fruitful, and faithful in every season. Amen.",
    tlPrayer: "Ama, palalimin Mo ang aming ugat sa Iyong Salita. Gawin Mo kaming matatag, mabunga, at tapat sa bawat season. Amen.",
    declaration: "I am rooted in God’s Word, and my life will bear lasting fruit.",
    tlDeclaration: "Nakaugat ako sa Salita ng Diyos, at ang buhay ko ay mamumunga nang pangmatagalan."
  },
  {
    ref: "Mark 10:45",
    verse: "For even the Son of Man did not come to be served, but to serve, and to give His life a ransom for many.",
    title: "LEADERSHIP THAT SERVES",
    tlTitle: "PAMUMUNONG NAGLILINGKOD",
    article: "Jesus redefined greatness. Kingdom leadership is not about demanding attention; it is about carrying responsibility for others. Look for someone you can serve today—at home, at work, in church, or in the community. The strongest men are secure enough to kneel, serve, and lift others.",
    tlArticle: "Binago ni Jesus ang kahulugan ng tunay na greatness. Ang Kingdom leadership ay hindi tungkol sa paghahanap ng attention; ito ay tungkol sa pagdadala ng responsibilidad para sa iba. Humanap ngayon ng taong maaari mong paglingkuran—sa bahay, trabaho, church, o community. Ang tunay na malakas na lalaki ay secure enough para yumuko, maglingkod, at mag-angat ng iba.",
    prayer: "Lord Jesus, give us servant hearts. Remove pride and make our leadership a reflection of Your humility, courage, and love. Amen.",
    tlPrayer: "Panginoong Jesus, bigyan Mo kami ng pusong naglilingkod. Alisin Mo ang pride at gawin ang aming leadership na larawan ng Iyong humility, tapang, at pag-ibig. Amen.",
    declaration: "I lead by serving, following the example of Jesus.",
    tlDeclaration: "Mamumuno ako sa pamamagitan ng paglilingkod, ayon sa halimbawa ni Jesus."
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
    "English + Tagalog",
    "",
    `📖 ${d.ref}`,
    `“${d.verse}”`,
    "",
    `🔥 ${d.title}`,
    d.article,
    "",
    `🇵🇭 ${d.tlTitle}`,
    d.tlArticle,
    "",
    "🎯 TODAY'S ACTION / GAWIN NGAYON",
    "Lead one person with prayer, encouragement, or practical service today.",
    "Pangunahan at palakasin ang isang tao ngayon sa pamamagitan ng panalangin, encouragement, o praktikal na paglilingkod.",
    "",
    "🙏 PRAYER / PANALANGIN",
    d.prayer,
    d.tlPrayer,
    "",
    "🛡️ DECLARATION / PAHAYAG",
    d.declaration,
    d.tlDeclaration,
    "",
    "💬 Brotherhood Question: What is one area where you need God’s strength today?",
    "Ano ang isang bahagi ng buhay mo na kailangan mo ang lakas ng Diyos ngayon?",
    "",
    "#KingdomMenHawaii #MenOfGod #Faith #Family #Brotherhood"
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
  if (running || process.env.KINGDOM_MEN_SCHEDULER_PAUSED === "1") return false;
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
    console.log(`[Kingdom Men] Bilingual Daily Telegram post sent (${reason}) for ${hp.date} Hawaii.`);
    return true;
  } catch (err) {
    console.log(`[Kingdom Men] Daily Telegram send failed: ${err.message}`);
    return false;
  } finally {
    running = false;
  }
}

async function tick() {
  if (process.env.KINGDOM_MEN_SCHEDULER_PAUSED === "1") return;
  const hp = hawaiiParts();
  if (hp.hour === 7 && hp.minute <= 4 && lastSentDate !== hp.date) {
    await sendDaily("7am_hawaii");
  }
}

if (process.env.KINGDOM_MEN_TEST_ON_START === "1" && process.env.KINGDOM_MEN_SCHEDULER_PAUSED !== "1") {
  setTimeout(() => sendDaily("startup_test"), 5000);
}

setInterval(tick, 30000);
setTimeout(tick, 10000);

module.exports = { sendDaily, hawaiiParts };
