---
project: startupstate
priority: future
created: 2026-05-08
---
# Agentic voice interviews + Socratic profile refinement overlay

Hackathon v1 derives the founder profile from passive signals (Gmail, Drive, local docs) and never asks the founder a question. This works when artifacts are rich, but for early founders with sparse history the inferred profile will have low confidence in stage / industry / gaps.

A later spec should add an in-page overlay on `startup.utah.gov` that runs a short, voice-driven Socratic interview to fill confidence gaps — *not* a long form. Targets:

- Voice in / voice out (browser SpeechRecognition + TTS, or a hosted realtime API)
- LLM agent that reads the current low-confidence fields and asks 1–3 follow-up questions, branching on answers
- Each turn is captured as an `ingestedSignal` with provenance `interview` so it merges into the profile the same way passive signals do
- Overlay matches the augmentation styling so the experience feels continuous

Anti-goal: anything that resembles a long-form interview or onboarding wizard. Cap turn count, surface "skip" affordances, never block the user from the main site.

Dependent on: a confidence model for founder-profile fields (currently not in spec — would be added with this work).
