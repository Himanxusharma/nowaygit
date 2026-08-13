---
name: nowaygit-build
description: Use this skill whenever working on the "nowaygit" Chrome extension project — building, extending, debugging, or planning any part of it. This covers the extension that pushes claude.ai artifact content to GitHub repos via a "Push to GitHub" button injected into the artifact panel. Trigger this for tasks like: writing the manifest.json, content script, background service worker, GitHub Device Flow auth, Contents/Git Data API integration, artifact DOM extraction, or any question about scope/architecture for this specific product. Always consult the bundled BRD/PRD/FRD/TRD before proposing new features or changing scope, so decisions stay consistent with what's already been validated.
---

# nowaygit — Build Context

## What this project is

A Chrome extension (Manifest V3) that lets users push claude.ai artifact content directly to a GitHub repo — new or existing — without manually copying/downloading files. See `README.md` for the pitch, `BRD.md` for business rationale, `PRD.md` for user stories/feature priority, `FRD.md` for exact functional behavior, and `TRD.md` for the implementation architecture. These four docs are the source of truth — don't introduce scope or architecture decisions that contradict them without flagging the conflict to the user first.

## Non-negotiable decisions already made (don't re-litigate without asking)

- **Platform: Chrome extension, not a web app.** The core mechanism requires reading live DOM inside an open claude.ai tab — a web app can't do that. See README's "Platform Decision" reasoning if re-explaining this to anyone.
- **Extraction method: DOM-based by default.** An undocumented Claude.ai internal API exists and is more reliable, but using it is a ToS gray area. It may only ever be an opt-in, clearly-disclosed fallback — never the default extraction path.
- **GitHub auth: OAuth Device Flow**, not standard Authorization Code flow. A pure client-side extension can't safely hold a client secret; Device Flow needs only `client_id`.
- **Default push behavior: create branch + open PR**, not direct commit to main. Direct push is an explicit user override, not the default.
- **No backend server in MVP.** All GitHub/Anthropic API calls happen client-side from the background service worker. Token storage: GitHub token in `chrome.storage.session` (never `localStorage`/synced storage); Anthropic API key (user-supplied) in `chrome.storage.local`.

## Architecture quick-reference

```
claude.ai tab → content script (inject button, extract artifact DOM)
             → chrome.runtime messaging
             → background service worker
                  → GitHub Device Flow auth
                  → GitHub REST: Contents API (single file) / Git Data API (multi-file, P1)
                  → Anthropic API (commit message / README generation)
popup UI → repo picker, auth status, settings
```

Full endpoint-by-endpoint detail (which GitHub API calls, in what order, with what payloads) is in `TRD.md` Section 4 — read that before writing any GitHub integration code rather than re-deriving the flow from scratch.

## MVP scope (P0) — build this first, nothing else

1. Artifact detection + injected "Push to GitHub" button
2. GitHub Device Flow auth
3. Repo picker: existing repo+path, or create new (public/private)
4. Branch+PR default push, direct-push override
5. AI-generated, editable commit message
6. Success/error toast with link to result

P1/P2 features (diff preview, whole-conversation push, auto-README, round-trip import, deploy triggers, watch mode) are documented in `PRD.md` — don't build these before P0 is solid, and don't silently expand scope mid-build.

## When extending or changing scope

If a request would contradict a decision in the "non-negotiable" list above (e.g., "let's default to direct push" or "let's use the internal API by default"), flag the tradeoff explicitly rather than just implementing it — these were deliberate calls tied to safety/ToS reasoning, not arbitrary defaults.

## Naming

The product name is **nowaygit** (manifest.json `name`: "nowaygit").
