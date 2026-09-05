# RevivaLink Viral Relay

Purpose: keep the YouTube API key server-side while the Web on Demand dashboard calls a safe relay.

## Endpoints
- `GET /health`
- `GET /api/youtube/search?q=prayer+sermon&license=creativeCommon&duration=long&maxResults=25`
- `POST /api/queue`

## Viral scoring
The relay combines view velocity, engagement, freshness, comment activity, and clip potential into a 0–100 score.

## Rights behavior
- YouTube `creativeCommon` is marked `SAFE_WITH_TERMS`, not automatically cleared for every commercial use.
- Standard YouTube license is marked `INSPIRATION_ONLY` until explicit permission/license evidence is verified.
- Do not use `contentDetails.licensedContent` as permission to reuse; it indicates partner-claimed licensed content, not a reuse grant.

## Start
1. Copy `.env.example` to `.env`
2. Set `YOUTUBE_API_KEY`
3. `npm install`
4. `npm start`

Set `ALLOWED_ORIGIN` to the live RevivaLink dashboard origin.
