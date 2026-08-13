# Technical Requirements Document (TRD)
## nowaygit

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
chrome.storage.local — non-sensitive prefs (last-used repo/path, default push mode)
```

No backend server in MVP. Fully client-side extension, GitHub and Anthropic APIs called directly from the background service worker.

### 2. Platform & Stack

- **Extension platform:** Chrome Manifest V3 (required for Chrome Web Store as of 2026)
- **Language:** TypeScript
- **UI:** React for popup + injected panel, Tailwind for styling (kept minimal to match claude.ai's own visual weight — no heavy component library needed for this surface area)
- **Build:** Vite (fast rebuilds, native MV3 output support via community plugin)
- **Permissions requested in manifest.json:**
  - `identity` — not usable for GitHub directly (chrome.identity.getAuthToken is Google-account-specific); used only if `launchWebAuthFlow` is needed as a fallback path
  - `storage` — for session/local storage described above
  - `host_permissions`: `https://claude.ai/*` (content script + injection), `https://api.github.com/*`, `https://github.com/*` (device flow endpoints), `https://api.anthropic.com/*` (commit message/README generation)
  - No `<all_urls>`, no `tabs` beyond what's implicitly needed — minimizes Web Store review friction and user-facing permission warnings.

### 3. Artifact Extraction — Technical Detail

**Primary method: DOM-based extraction**
- MutationObserver on the artifact panel container to detect mount/update.
- Read rendered content from the panel's code/text container; for code artifacts, read from the syntax-highlighted block's underlying text node (not the highlighted HTML, to avoid capturing highlighting markup).
- Extension re-derives file extension from the artifact type label the panel displays.
- Known fragility: this breaks if Anthropic changes the artifact panel's DOM structure. Mitigate with: (a) a small, isolated selector-config module so fixes are one-file changes, (b) a "content looks wrong / empty" self-check before allowing a push (minimum length heuristic, non-empty check) to fail loud instead of pushing garbage.

**Fallback method: internal API interception (opt-in, disclosed)**
- Available for users who opt in via settings, clearly labeled as unofficial/best-effort and subject to breaking without notice.
- Not enabled by default; not used for any function unless the user explicitly turns it on.

### 4. GitHub Integration — Technical Detail

**Auth: OAuth Device Flow**
1. `POST https://github.com/login/device/code` with `client_id` + scopes (`repo` for private repo access, or `public_repo` if the product ever offers a public-only mode) → returns `device_code`, `user_code`, `verification_uri`.
2. Display `user_code` + `verification_uri` to user.
3. Poll `POST https://github.com/login/oauth/access_token` with `device_code` at the server-specified interval until `access_token` is returned or the code expires.
4. Store `access_token` in `chrome.storage.session`.

No client secret required at any point — this flow is safe for a fully client-side extension, unlike the standard Authorization Code flow.

**Repo listing:** `GET /user/repos?sort=updated` (paginated).

**Repo creation:** `POST /user/repos` with `name`, `description`, `private`.

**Single-file push:**
1. `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — check existence, capture `sha` if present.
2. If branch+PR mode: `POST /repos/{owner}/{repo}/git/refs` to create a new branch from the default branch's latest commit SHA.
3. `PUT /repos/{owner}/{repo}/contents/{path}` with base64 content, commit message, target branch, and `sha` if updating.
4. If branch+PR mode: `POST /repos/{owner}/{repo}/pulls` to open the PR against the default branch.

**Multi-file push (P1, Git Data API):**
1. `POST /repos/{owner}/{repo}/git/blobs` per file → returns blob SHA.
2. `POST /repos/{owner}/{repo}/git/trees` with all blob SHAs + paths → returns tree SHA.
3. `POST /repos/{owner}/{repo}/git/commits` with tree SHA + parent commit SHA → returns commit SHA.
4. `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` to point the branch at the new commit.

**Rate limits:** 5,000 authenticated requests/hour — track remaining via `X-RateLimit-Remaining` response header; surface a warning in UI if under 50 remaining.

**File size limits:** Contents API `PUT` supports files up to 100 MB; large files should route through the Git Data API blob endpoint regardless for consistency.

### 5. Claude API Integration (Commit Messages / README)

- Background worker calls `POST https://api.anthropic.com/v1/messages` with the artifact diff/content as context, requesting a concise commit message (or README draft for P1).
- Model: latest available Sonnet-tier model at build time; request kept to `max_tokens` sufficient for a commit message (~100) or a short README (~800).
- API key handling: user supplies their own Anthropic API key in settings (stored in `chrome.storage.local`, not session, since it's needed across sessions) — MVP does not proxy through a Himxu-owned backend, avoiding key custody and cost liability. A hosted-proxy option can be considered later as a paid tier.

### 6. Security Requirements

- GitHub token stored in `chrome.storage.session` only — never `localStorage`, never synced storage, cleared on browser close.
- Anthropic API key (if used for commit messages) stored in `chrome.storage.local`, scoped to the extension, never transmitted anywhere except directly to `api.anthropic.com`.
- No third-party analytics or telemetry that transmits artifact content off-device.
- All API calls made directly from the background service worker to GitHub/Anthropic — no intermediary server in MVP, minimizing the extension's own attack surface and data custody.
- Content Security Policy in manifest restricts script sources to self; no remote code execution.

### 7. Reliability & Error Handling

- Every GitHub API call wrapped with explicit handling for: 401 (auth expired → re-auth prompt), 403 (rate limit or permission → specific message), 404 (repo/path not found → destination re-picker), 409 (sha conflict → diff/conflict UI), network failure (retry with backoff, max 3 attempts).
- Extraction self-check (Section 3) prevents pushing empty/malformed content.

### 8. Testing Strategy

- Unit tests for extraction logic against fixture DOM snapshots of each artifact type (react, html, markdown, code, svg).
- Integration tests against GitHub API using a disposable test repo/token in CI.
- Manual QA checklist per release: new repo creation, existing repo update with conflict, branch+PR flow, direct push, auth expiry recovery, large-file push.

### 9. Deployment

- Chrome Web Store listing, MV3-compliant package.
- Versioned releases; changelog maintained in this repo's own README.
- No server infrastructure to deploy for MVP — reduces time-to-ship and ongoing hosting cost to zero.

### 10. Open Technical Risks (carried from BRD)

- DOM-based extraction is coupled to claude.ai's current markup and will require maintenance as Anthropic updates its UI.
- Internal-API fallback, if ever enabled by default in a future version, would need a fresh ToS review before that change.
