---
project: startupstate
priority: future
created: 2026-05-08
---
# Utah Startup Map (Hackathon Part 2)

The hackathon brief has two deliverables. This spec covers Part 1 only (Founder's Navigator). Part 2 is a separate effort:

> An interactive, filterable visual map of Utah's startup ecosystem — companies, investors, accelerators, hubs — designed for investors and entrepreneurs to *see* the ecosystem at a glance. Reference: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN

Source data lives in: https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit

A later spec should:

- Define the data schema for map entities (company, investor, hub, university program) including geocoded location, industry tags, stage, founding year
- Choose a renderer (Leaflet, Mapbox, deck.gl) and decide whether the map is a hackathon site (`apps/marketing/...` route) or another browser-extension surface
- Define the filter UX for both founder and investor personas
- Decide whether the founder profile from Part 1 personalizes the map (e.g., highlight peers in the same industry/stage)

Reuses Part 1 infra: Convex schema namespace, sheet-import pipeline, OAuth identity.

Judges noted: prioritize one exceptional product over two rushed ones. Land Part 1 first; only attempt Part 2 if Part 1 is demo-ready with time to spare.
