# Technical Requirements Document (TRD) — Production
## Claude → GitHub Bridge
**Version 2.0 — Production-Ready**

---

### 1. Architecture Overview

```
claude.ai tab
 └─ Content script (injected UI + DOM extraction)
      └─ chrome.runtime messaging
           └─ Background service worker (MV3)
                ├─ GitHub Device Flow auth
                ├─ GitHub REST API calls (Contents API / Git Data API)
                └─ Claude API call (commit message / README generation)
Popup UI (extension action) — repo picker, settings, auth status
chrome.storage.session — token storage (cleared on browser close)
chrome.storage.local — non-sensitive prefs (last-used repo/path, default push mode, API key)
```

No backend server. Fully client-side extension; GitHub and Anthropic APIs called directly from the background service worker.

### 2. Platform & Stack

- **Extension platform:** Chrome Manifest V3
- **Language:** TypeScript, strict mode enabled
- **UI:** React for popup + injected panel, Tailwind (scoped/prefixed to avoid leaking styles into claude.ai's page)
- **Build:** Vite with a Manifest V3 plugin (e.g. `@crxjs/vite-plugin`)
- **State management:** React context + `chrome.storage` listeners — no external state library needed at this scope
- **Manifest permissions:**
  - `storage` — session/local storage
  - `host_permissions`: `https://claude.ai/*`, `https://api.github.com/*`, `https://github.com/*`, `https://api.anthropic.com/*`
  - No `<all_urls>`, no `tabs`, no `identity` (Device Flow doesn't need Chrome's identity API)

### 3. Artifact Extraction

**Primary method: DOM-based extraction**
- `MutationObserver` on the artifact panel container to detect mount/update.
- Read rendered content from the panel's underlying text node, not syntax-highlighted HTML.
- Derive file extension from the artifact type label the panel displays; fall back to `.txt` + user prompt if undetermined (FR-1.5).
- Isolate all DOM selectors in a single `selectors.ts` config module so UI changes on Anthropic's side require a one-file patch, not a rewrite.
- Extraction self-check: minimum length heuristic + non-empty check before enabling the push button (backs FR-2.4).

**Fallback method: internal API interception (opt-in only, off by default)**
- Available behind a settings toggle, clearly labeled "unofficial, may break without notice."
- Never used unless explicitly enabled by the user.

**Monitoring extraction health:** log a local (non-transmitted) counter of extraction failures; if failure rate crosses a threshold across a release, treat as a P0 bug — Anthropic likely changed the DOM structure.

### 4. GitHub Integration

**Auth: OAuth Device Flow**
1. `POST https://github.com/login/device/code` with `client_id` + scopes (`repo`) → returns `device_code`, `user_code`, `verification_uri`, `expires_in`, `interval`.
2. Display `user_code` + `verification_uri`.
3. Poll `POST https://github.com/login/oauth/access_token` with `device_code` at the specified `interval` until `access_token` returned, `access_denied`, or `expired_token`.
4. Store `access_token` in `chrome.storage.session`.

No client secret required — safe for a fully client-side extension.

**Repo listing:** `GET /user/repos?sort=updated&per_page=100`, paginated via `Link` header if needed.

**Repo creation:** `POST /user/repos` — `name`, `description`, `private`. Client-side validation of `name` against GitHub's allowed character set before submission (FR-4.6).

**Single-file push:**
1. `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — check existence, capture `sha`.
2. If branch+PR mode: `POST /repos/{owner}/{repo}/git/refs` to branch from the default branch's latest commit SHA.
3. `PUT /repos/{owner}/{repo}/contents/{path}` — base64 content, commit message, branch, `sha` if updating.
4. If branch+PR mode: `POST /repos/{owner}/{repo}/pulls`.

**Multi-file push (P1, Git Data API):**
1. `POST /repos/{owner}/{repo}/git/blobs` per file.
2. `POST /repos/{owner}/{repo}/git/trees` with all blob SHAs + paths.
3. `POST /repos/{owner}/{repo}/git/commits`.
4. `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}`.

**Rate limits:** 5,000 req/hr authenticated. Track `X-RateLimit-Remaining`; warn in UI under 50 remaining; implement client-side exponential backoff (base 1s, max 3 retries) on 403 rate-limit responses (backs FR-7.4).

**File size limits:** Contents API `PUT` supports up to 100MB; route anything near that size through the Git Data API blob endpoint for consistency; hard-block above 100MB per FR-7.4.

### 5. Claude API Integration

- Background worker calls `POST https://api.anthropic.com/v1/messages` with artifact diff/content as context for commit message (P0) or README draft (P1).
- User supplies their own Anthropic API key (Settings, FR-8.1); stored in `chrome.storage.local`.
- Timeout: 5 seconds; on failure or missing key, fall back to a templated commit message (FR-5.5) — this call must never block the push.

### 6. Security Requirements

- GitHub token: `chrome.storage.session` only, never `localStorage`/synced storage, cleared on browser close.
- Anthropic API key: `chrome.storage.local`, scoped to the extension, transmitted only to `api.anthropic.com`.
- No third-party analytics SDKs that transmit artifact content or tokens off-device. If P1 analytics ship, they carry counts/flags only (e.g., "push_succeeded": true), never content or identifiers tied to repo/file names.
- Content Security Policy restricts script sources to `self`; no remote code execution, no `eval`.
- Extension requests the minimum GitHub scope needed (`repo` for private repo support); document exactly why this scope is required in the Chrome Web Store listing to pass review.
- Threat model summary: primary risk is token theft via a compromised extension update or a malicious dependency. Mitigation: minimal dependency footprint, lockfile pinning, no dynamic script loading, session-scoped token storage limits blast radius.

### 7. Reliability & Error Handling

- Every GitHub API call wrapped with explicit handling per the failure table in FRD Section 3.
- Retry policy: network failures retry 3x with exponential backoff before surfacing an error; auth/permission errors never auto-retry (require user action).
- Extraction self-check prevents empty/malformed pushes (Section 3 above).

### 8. Testing Strategy & Severity Definitions

**Severity definitions (used for release gating in PRD Section 8):**
- **P0:** Data loss, silent overwrite, or credential leak. Blocks release.
- **P1:** Core flow (auth, push, repo create) fails for a common case. Blocks release.
- **P2:** Edge case or cosmetic issue with a workaround. Does not block release, tracked for fast-follow.

**Test layers:**
- Unit tests for extraction logic against fixture DOM snapshots of each artifact type (react, html, markdown, code, svg, json).
- Unit tests for the commit-message fallback path (Anthropic call disabled/failing).
- Integration tests against GitHub API using a disposable test repo/token in CI (create repo → push → verify content → teardown).
- Manual QA checklist per release, run against a real GitHub account:
  1. New repo creation (public and private)
  2. Existing repo, new file
  3. Existing repo, file update, no conflict
  4. Existing repo, file update, conflict (diff shown, blocked until confirm)
  5. Sha-mismatch mid-flow (simulate concurrent edit)
  6. Branch+PR flow end to end
  7. Direct push flow end to end
  8. Auth expiry recovery
  9. Rate-limit simulation (mock 403 response)
  10. Large file (~90MB) push
  11. Empty/failed extraction handling
  12. Onboarding flow, fresh install

### 9. Observability (production operations)

- Local-only error logging surfaced in a "Diagnostics" panel in settings (last 20 errors, exportable as text for support requests) — no automatic transmission.
- Version pinning: every release tagged; rollback = re-publishing the previous tagged build to the Chrome Web Store (target: under 1 hour, per PRD release criteria).
- Changelog maintained in `README.md`; every release documents what changed, especially any DOM-selector patches (since those indicate upstream claude.ai changes).

### 10. Deployment

- Chrome Web Store listing, MV3-compliant package, privacy policy published (required for `host_permissions` covering claude.ai and GitHub).
- No server infrastructure — zero ongoing hosting cost.
- Versioned releases via semantic versioning; `manifest.json` `version` field bumped every release.

### 11. Open Risks Carried to Production

| Risk | Status | Owner action |
|---|---|---|
| DOM-based extraction coupled to claude.ai's markup | Accepted, mitigated via selector isolation + extraction self-check | Monitor extraction failure counter each release |
| Internal-API fallback ToS gray zone | Mitigated — opt-in, off by default, clearly disclosed | Re-review before ever considering default-on |
| No product-owned Anthropic billing | Accepted for v1 (user supplies own key) | Revisit if a paid tier with hosted commit-message generation is built |
| Single point of failure: GitHub API availability | Accepted — no control over GitHub uptime | Surface GitHub status clearly on failure, no silent hangs |
