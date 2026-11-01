# Radio Desk — college basketball audio visualization

Updated: 2026-11-01. Cost: $0. This component applies **only to college basketball Gamefiles** and does not modify NFL or other sports.

## Current verified broadcast discovery
- Notre Dame men's basketball: https://fightingirish.com/mbb-live-radio-broadcast
- Notre Dame men's and women's radio network: https://fightingirish.com/radioaffiliates
- Learfield's free The Varsity Network discovery: https://thevarsitynetwork.com/audioapplink

These links are official listening destinations, **not** approved direct audio sources for this website. None is currently confirmed to permit us to inspect its audio samples via Web Audio. Do not scrape stream URLs, relay streams, transcribe calls, defeat CORS, or embed an unauthorized copy. Official playback may vary by event/region.

## Approved-stream requirement
The source registry is `data/cbb-radio-sources.json`. A stream can be activated for the audio-reactive experience **only if all of the following are documented and tested**:

1. The actual broadcaster or rights-holder approves browser-side audio analysis by the independent Sporting Life & Times site (record the public evidence URL).
2. The broadcaster supplies a direct, browser-playable HTTPS audio URL, not an iframe, unlicensed scrape, third-party copy or access-controlled audio.
3. The streaming response permits CORS from our GitHub Pages origin and works with `audio.crossOrigin = "anonymous"`.
4. A tested expiration date, `verified_until`, is set. Re-verify if conditions or policies change.

A source entry must then have `visualization_permission: "explicit"`, `cors_verified: true`, `permission_evidence_url` (HTTPS), `verified_until` (future date), and `direct_audio_url` (HTTPS). Until then every source remains external-listen-only. **Never set these flags by assumption.**

## Privacy and playback
- Every listener explicitly taps the Play button; no autoplay.
- The broadcaster delivers the audio directly to the listening device. We do not proxy or upload audio through GitHub, our server, a third-party AI, or another service.
- `AudioContext` + `MediaElementAudioSourceNode` + `AnalyserNode` paint a transient waveform in memory. No microphone, tab/screen capture, recording, transcription, storage, clip generation, replay, or backend audio processing.
- Pausing stops visualization. The broadcaster may retain its own standard connection logs; our site does not control that provider.
- A live audio waveform is NOT possession, shot placement, ball tracking, announcer interpretation or play detection. Verified Gamefile score and play events remain an entirely separate source.
- Radio may be delayed relative to the basketball scoreboard, by tens of seconds or more.

## Reliability tests
`node tests/cbb-radio-companion.test.cjs` verifies rights/CORS gating, source selection, absent recording/mic APIs, and integration. The static site audit and Pages publisher both run this test.

## Next actual onboarding milestone
Ask the broadcaster for **free written permission** and a compatible, explicitly shared stream URL; verify CORS in a real phone browser. Without that cooperation, show official listening links and sourced game visualization but **never fake an audio-responsive waveform**.
