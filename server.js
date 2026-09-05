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

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "RevivaLink Viral Relay",
    message: "Use /health, /api/youtube/search, /api/queue, or /api/handoff/*"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "RevivaLink Viral Relay",
    version: "2.1.0",
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
      )
    }
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RevivaLink Viral Relay v2.1 listening on :${PORT}`);
});
