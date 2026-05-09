---
project: startupstate
priority: future
created: 2026-05-08
---
# Background ingest for Gmail / Drive / local folder

Hackathon v1 ingests on demand from the extension popup. Founders must explicitly trigger a sweep, and the extension does not refresh signals when new emails arrive or when a Drive doc is edited.

A later spec should add a scheduled or event-driven re-ingest path so the founder profile stays fresh without user effort. Candidates:

- Convex cron at a low interval (hourly / daily) per connected source
- Gmail push notifications via Pub/Sub for incremental updates
- Drive Activity API or change tokens for delta sync
- Local folder: requires a native messaging host or service worker that survives the browser session — out of scope for FSA-only

Open questions:
- Quota and cost ceiling for unattended ingest
- How to surface ingest activity in the UI without being noisy
- Conflict resolution when the founder edits the inferred profile manually
