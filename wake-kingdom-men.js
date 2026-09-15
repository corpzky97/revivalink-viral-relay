// Wakes the free Render web service shortly before the Kingdom Men 7:00 AM Hawaii post.
(async () => {
  try {
    const r = await fetch("https://revivalink-viral-relay.onrender.com/health", {
      signal: AbortSignal.timeout(60000)
    });
    console.log(`[Kingdom Men Wake] ${r.status} ${r.ok ? "ok" : "failed"}`);
    process.exit(r.ok ? 0 : 1);
  } catch (err) {
    console.error(`[Kingdom Men Wake] ${err.message}`);
    process.exit(1);
  }
})();
