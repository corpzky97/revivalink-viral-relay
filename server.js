const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://chatgpt-1xaflta5.webondemand.com";

app.use(cors({
  origin(origin, cb) {
    if (!origin || origin === ALLOWED_ORIGIN) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "1mb" }));

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function isoDurationToSeconds(iso = "") {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

function humanDuration(iso = "") {
  const total = isoDurationToSeconds(iso);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function viralScore({ views, likes, comments, publishedAt }) {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(publishedAt).getTime()) / 3600000
  );
  const viewsPerHour = views / ageHours;
  const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

  const velocityScore = clamp((Math.log10(Math.max(1, viewsPerHour)) / 4) * 100);
  const engagementScore = clamp((engagement / 8) * 100);
  const freshnessScore = clamp(100 - Math.min(ageHours / 24, 14) * (100 / 14));
  const commentScore = clamp((Math.log10(Math.max(1, comments)) / 4) * 100);

  return Math.round(
    velocityScore * 0.40 +
    engagementScore * 0.25 +
    freshnessScore * 0.20 +
    commentScore * 0.15
  );
}

function buildAttribution(body) {
  return {
    speakerCredit: String(body.speakerCredit || "").trim(),
    ownerCredit: String(body.ownerCredit || body.channelTitle || "").trim(),
    sourceUrl: String(body.sourceUrl || body.url || "").trim(),
    sourceTitle: String(body.title || "").trim(),
    sourceChannel: String(body.channelTitle || "").trim(),
    license: String(body.license || "").trim(),
    rightsStatus: String(body.rightsStatus || "").trim()
  };
}

function validateHandoff(body) {
  if (!body || typeof body !== "object") return "JSON body required";
  if (!body.sourceUrl && !body.url) return "sourceUrl is required";
  if (!body.title) return "title is required";
  if (body.rightsStatus && body.rightsStatus !== "SAFE_WITH_TERMS") {
    return "Only SAFE_WITH_TERMS items may enter external clipping/distribution handoffs";
  }
  return null;
}

async function parseResponse(response) {
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return body;
}

async function postBearer(url, apiKey, payload) {
  if (!url || !apiKey) {
    return { ok: false, configured: false, status: "not_configured" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseBody = await parseResponse(response);
  return {
    ok: response.ok,
    configured: true,
    status: response.ok ? "sent" : "failed",
    httpStatus: response.status,
    response: responseBody
  };
}


const PROTECTED_TOPIC_PATTERNS = [
  { name: "prophecy", re: /\b(prophec(?:y|ies|tic)|prophetic word|thus saith|prediction)\b/i },
  { name: "breaking_news", re: /\b(breaking news|developing story|just in|urgent update)\b/i },
  { name: "israel_war_geopolitics", re: /\b(israel|gaza|hamas|hezbollah|iran|ukraine|russia|war|geopolitic|ceasefire|missile|military strike)\b/i },
  { name: "politics_elections", re: /\b(politic|election|ballot|vote|voting|candidate|president|congress|senate|governor|campaign)\b/i },
  { name: "legal_claims", re: /\b(lawsuit|legal claim|criminal charge|indictment|arrested|convicted|court ruled|attorney alleges)\b/i },
  { name: "ai_end_times", re: /\b(artificial intelligence|openai|chatgpt|ai\b.*\b(end times|antichrist|mark of the beast|revelation)|end times\b.*\bai)\b/i }
];

function detectProtectedTopic(body = {}) {
  if (body.protectedTopic === true || body.manualReviewOnly === true) {
    return { protected: true, category: String(body.protectedCategory || "manual_review") };
  }

  const text = [
    body.topic,
    body.title,
    body.viralHook,
    body.viral_hook,
    body.caption,
    body.angle,
    body.captionAngle,
    body.transcript,
    body.whyTrending
  ].filter(Boolean).join(" ");

  for (const rule of PROTECTED_TOPIC_PATTERNS) {
    if (rule.re.test(text)) return { protected: true, category: rule.name };
  }
  return { protected: false, category: "" };
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function arrayOrEmpty(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map(x => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeContentOSPayload(body = {}) {
  const attribution = buildAttribution(body);
  const rightsStatus = String(
    body.rightsStatus ||
    body.rights?.status ||
    attribution.rightsStatus ||
    ""
  ).trim();

  const sourceUrl = String(body.sourceUrl || body.url || "").trim();
  const title = String(body.topic || body.title || "").trim();
  const trendScore = numberOrZero(
    body.trendClipScore ??
    body.trend_score ??
    body.clipScore ??
    body.viralScore
  );

  const timestamps =
    body.timestamps && typeof body.timestamps === "object"
      ? body.timestamps
      : {
          start: body.clipStart ?? body.startTime ?? "",
          end: body.clipEnd ?? body.endTime ?? ""
        };

  const protectedTopic = detectProtectedTopic(body);

  return {
    source_url: sourceUrl,
    topic_title: title,
    viral_hook: String(body.viralHook || body.viral_hook || title || "").trim(),
    trend_clip_score: trendScore,
    freshness: numberOrZero(body.freshness ?? body.freshnessScore),
    ministry_relevance: numberOrZero(body.ministryRelevance ?? body.ministry_relevance),
    source_confidence: numberOrZero(body.sourceConfidence ?? body.source_confidence),
    suggested_format: String(body.suggestedFormat || body.suggested_format || body.format || "").trim(),
    caption_angle: String(body.captionAngle || body.caption_angle || body.caption || body.angle || "").trim(),
    hashtags: arrayOrEmpty(body.hashtags),
    clip: {
      timestamps,
      transcript: String(body.transcript || "").trim()
    },
    source_system: String(body.sourceSystem || body.source_system || "revivalink-viral-intelligence").trim(),
    rights: {
      status: rightsStatus,
      license: String(body.license || attribution.license || "").trim(),
      reuse_allowed: body.reuseAllowed === true || rightsStatus === "SAFE_WITH_TERMS",
      speaker_credit: attribution.speakerCredit,
      owner_credit: attribution.ownerCredit,
      source_title: attribution.sourceTitle,
      source_channel: attribution.sourceChannel
    },
    review: {
      approved: body.approved === true || String(body.approvalStatus || "").toLowerCase() === "approved",
      protected_topic: protectedTopic.protected,
      protected_category: protectedTopic.category,
      manual_review_only: protectedTopic.protected
    },
    created_at: String(body.createdAt || new Date().toISOString()),
    observed_at: String(body.observedAt || body.publishedAt || new Date().toISOString())
  };
}

async function postContentOS(payload) {
  const url = process.env.CONTENT_OS_WEBHOOK_URL;
  const token = process.env.CONTENT_OS_TOKEN;

  if (!url || !token) {
    return {
      ok: true,
      configured: false,
      status: "ready_for_content_os",
      message: "Validated Content OS package created, but CONTENT_OS_WEBHOOK_URL / CONTENT_OS_TOKEN are not configured."
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RevivaLink-Token": token
    },
    body: JSON.stringify(payload)
  });

  const responseBody = await parseResponse(response);
  return {
    ok: response.ok,
    configured: true,
    status: response.ok ? "sent" : "failed",
    httpStatus: response.status,
    response: responseBody
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "RevivaLink Viral Relay",
    message: "Use /health, /api/youtube/search, /api/queue, /api/handoff/*, or /api/intake/content-os"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "RevivaLink Viral Relay",
    version: "2.2.0",
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    handoffs: {
      opus: Boolean(process.env.OPUS_API_URL && process.env.OPUS_API_KEY),
      kingdomClipper: Boolean(
        process.env.KINGDOM_CLIPPER_WEBHOOK_URL &&
        process.env.KINGDOM_CLIPPER_API_KEY
      ),
      broadcastr: Boolean(
        process.env.BROADCASTR_WEBHOOK_URL &&
        process.env.BROADCASTR_API_KEY
      ),
      contentOS: Boolean(
        process.env.CONTENT_OS_WEBHOOK_URL &&
        process.env.CONTENT_OS_TOKEN
      )
    },
    contentOSMinScore: Number(process.env.CONTENT_OS_MIN_SCORE || 80)
  });
});

app.get("/api/youtube/search", async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Missing YOUTUBE_API_KEY" });
    }

    const q = String(req.query.q || "Christian sermon prayer revival").trim();
    const duration = String(req.query.duration || "any");
    const license = String(req.query.license || "creativeCommon");
    const maxResults = Math.min(25, Math.max(1, Number(req.query.maxResults || 15)));

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("maxResults", String(maxResults));
    searchUrl.searchParams.set("order", "date");
    searchUrl.searchParams.set("key", apiKey);
    if (["short", "medium", "long"].includes(duration)) {
      searchUrl.searchParams.set("videoDuration", duration);
    }
    if (license === "creativeCommon") {
      searchUrl.searchParams.set("videoLicense", "creativeCommon");
    }

    const sr = await fetch(searchUrl);
    const searchData = await sr.json();
    if (!sr.ok) {
      return res.status(sr.status).json({
        ok: false,
        error: "YouTube search failed",
        detail: searchData
      });
    }

    const ids = (searchData.items || [])
      .map(x => x?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) return res.json({ ok: true, items: [] });

    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "snippet,statistics,contentDetails,status");
    videosUrl.searchParams.set("id", ids.join(","));
    videosUrl.searchParams.set("key", apiKey);

    const vr = await fetch(videosUrl);
    const videos = await vr.json();
    if (!vr.ok) {
      return res.status(vr.status).json({
        ok: false,
        error: "YouTube video lookup failed",
        detail: videos
      });
    }

    const items = (videos.items || []).map(item => {
      const stats = item.statistics || {};
      const views = Number(stats.viewCount || 0);
      const likes = Number(stats.likeCount || 0);
      const comments = Number(stats.commentCount || 0);
      const licenseName = item.status?.license || "unknown";
      const isCC = licenseName === "creativeCommon";

      return {
        videoId: item.id,
        title: item.snippet?.title || "",
        url: `https://www.youtube.com/watch?v=${item.id}`,
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        duration: humanDuration(item.contentDetails?.duration || ""),
        durationIso: item.contentDetails?.duration || "",
        views,
        likes,
        comments,
        license: licenseName,
        viralScore: viralScore({
          views,
          likes,
          comments,
          publishedAt: item.snippet?.publishedAt || new Date().toISOString()
        }),
        rights: {
          status: isCC ? "SAFE_WITH_TERMS" : "INSPIRATION_ONLY",
          label: isCC
            ? "Creative Commons — verify attribution and source-specific terms"
            : "Standard YouTube license — inspiration only"
        }
      };
    }).sort((a, b) => b.viralScore - a.viralScore);

    res.json({ ok: true, query: q, count: items.length, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/queue", (req, res) => {
  const error = validateHandoff(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  res.status(202).json({
    ok: true,
    status: "accepted",
    queued: {
      title: req.body.title,
      sourceUrl: req.body.sourceUrl || req.body.url,
      viralScore: req.body.viralScore ?? null,
      rightsStatus: req.body.rightsStatus || "SAFE_WITH_TERMS",
      attribution: buildAttribution(req.body)
    }
  });
});

app.post("/api/handoff/opus", async (req, res) => {
  const error = validateHandoff(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const url = process.env.OPUS_API_URL || "https://api.opus.pro/api/clip-projects";
  const apiKey = process.env.OPUS_API_KEY;

  const payload = {
    videoUrl: req.body.sourceUrl || req.body.url
  };

  if (req.body.curationPref) payload.curationPref = req.body.curationPref;
  if (req.body.importPref) payload.importPref = req.body.importPref;
  if (req.body.brandTemplateId) payload.brandTemplateId = req.body.brandTemplateId;
  if (req.body.conclusionActions) payload.conclusionActions = req.body.conclusionActions;

  try {
    const result = await postBearer(url, apiKey, payload);
    const statusCode = result.ok ? 200 : result.configured ? 502 : 200;
    res.status(statusCode).json({
      ok: result.ok,
      handoff: "opus",
      ...result,
      payload,
      attribution: buildAttribution(req.body)
    });
  } catch (err) {
    res.status(502).json({ ok: false, handoff: "opus", error: err.message });
  }
});

app.post("/api/handoff/kingdom", async (req, res) => {
  const error = validateHandoff(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const attribution = buildAttribution(req.body);
  const payload = {
    title: req.body.title,
    sourceUrl: req.body.sourceUrl || req.body.url,
    speakerCredit: attribution.speakerCredit,
    ownerCredit: attribution.ownerCredit,
    license: attribution.license,
    rightsStatus: attribution.rightsStatus || "SAFE_WITH_TERMS",
    viralScore: Number(req.body.viralScore || 0),
    assetUrl: req.body.assetUrl || req.body.clipUrl || "",
    caption: req.body.caption || "",
    hashtags: Array.isArray(req.body.hashtags) ? req.body.hashtags : []
  };

  try {
    const result = await postBearer(
      process.env.KINGDOM_CLIPPER_WEBHOOK_URL,
      process.env.KINGDOM_CLIPPER_API_KEY,
      payload
    );
    res.status(result.ok ? 200 : result.configured ? 502 : 200).json({
      ok: result.ok,
      handoff: "kingdom",
      ...result,
      payload
    });
  } catch (err) {
    res.status(502).json({ ok: false, handoff: "kingdom", error: err.message });
  }
});

app.post("/api/handoff/broadcastr", async (req, res) => {
  const error = validateHandoff(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const attribution = buildAttribution(req.body);
  const payload = {
    title: req.body.title,
    sourceUrl: req.body.sourceUrl || req.body.url,
    speakerCredit: attribution.speakerCredit,
    ownerCredit: attribution.ownerCredit,
    license: attribution.license,
    rightsStatus: attribution.rightsStatus || "SAFE_WITH_TERMS",
    viralScore: Number(req.body.viralScore || 0),
    assetUrl: req.body.assetUrl || req.body.clipUrl || "",
    caption: req.body.caption || "",
    platforms: Array.isArray(req.body.platforms) ? req.body.platforms : [],
    scheduleTime: req.body.scheduleTime || ""
  };

  try {
    const result = await postBearer(
      process.env.BROADCASTR_WEBHOOK_URL,
      process.env.BROADCASTR_API_KEY,
      payload
    );
    res.status(result.ok ? 200 : result.configured ? 502 : 200).json({
      ok: result.ok,
      handoff: "broadcastr",
      ...result,
      payload
    });
  } catch (err) {
    res.status(502).json({ ok: false, handoff: "broadcastr", error: err.message });
  }
});


app.post("/api/intake/content-os", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ ok: false, status: "failed", error: "JSON body required" });
    }

    const payload = normalizeContentOSPayload(req.body);
    const minScore = Number(process.env.CONTENT_OS_MIN_SCORE || 80);

    if (!payload.source_url) {
      return res.status(400).json({ ok: false, status: "failed", error: "source URL is required" });
    }

    if (!payload.topic_title) {
      return res.status(400).json({ ok: false, status: "failed", error: "topic/title is required" });
    }

    if (payload.review.protected_topic) {
      return res.status(202).json({
        ok: true,
        status: "manual_review",
        reason: "protected_topic",
        protectedCategory: payload.review.protected_category,
        payload
      });
    }

    if (!payload.review.approved) {
      return res.status(202).json({
        ok: true,
        status: "manual_review",
        reason: "not_approved",
        payload
      });
    }

    if (!payload.rights.reuse_allowed) {
      return res.status(202).json({
        ok: true,
        status: "manual_review",
        reason: "rights_not_cleared",
        payload
      });
    }

    if (payload.trend_clip_score < minScore) {
      return res.status(202).json({
        ok: true,
        status: "held_by_score",
        minimumScore: minScore,
        payload
      });
    }

    const result = await postContentOS(payload);
    const statusCode = result.ok ? (result.configured ? 200 : 202) : 502;

    return res.status(statusCode).json({
      ok: result.ok,
      handoff: "content-os",
      ...result,
      payload
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      handoff: "content-os",
      status: "failed",
      error: err.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RevivaLink Viral Relay v2.2 listening on :${PORT}`);
});