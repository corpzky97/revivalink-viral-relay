# RevivaLink Viral Relay v2.2

Adds a Content OS production handoff:

POST /api/intake/content-os

## Server-only environment variables

- CONTENT_OS_WEBHOOK_URL
- CONTENT_OS_TOKEN
- CONTENT_OS_MIN_SCORE (optional, default 80)

Existing v2.1 environment variables remain unchanged.

## Behavior

- Normalizes the RevivaLink Content OS payload.
- Preserves rights/reuse and attribution metadata.
- Requires approval + reuse clearance + high score for automatic handoff.
- Protected topics are always returned as `manual_review` and are never auto-forwarded:
  prophecy, breaking news, Israel/war/geopolitics, politics/elections, legal claims, and AI/end-times claims.
- Tokens are used only by the relay and are never returned to browser JavaScript.
- If CONTENT_OS_WEBHOOK_URL / CONTENT_OS_TOKEN are not yet configured, the endpoint returns
  `ready_for_content_os` with the validated normalized package so the contract can be tested safely.
