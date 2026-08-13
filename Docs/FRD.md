# Functional Requirements Document (FRD) — Production
## Claude → GitHub Bridge
**Version 2.0 — Production-Ready**

---

### 1. Purpose
Defines exactly what the system must do, function by function, with full acceptance criteria and edge-case handling. Independent of implementation detail (covered in TRD).

### 2. Functional Modules

#### FR-1: Artifact Detection
- FR-1.1: Detect when an artifact panel is open in the active claude.ai tab.
- FR-1.2: Inject a "Push to GitHub" button into the artifact toolbar without disrupting native claude.ai UI or layout.
- FR-1.3: Re-detect artifacts when the user switches between artifact versions/revisions within the same conversation.
- FR-1.4: Infer a filename and extension from the artifact's declared type (react → .jsx, html → .html, markdown → .md, python → .py, plaintext → .txt, svg → .svg, json → .json), with a manual override field.
- FR-1.5 (edge case): If the artifact type cannot be determined, default to `.txt` and prompt the user to confirm/change the extension before push is enabled.
- FR-1.6 (edge case): If no artifact is open (button somehow triggered without one), the button must not render at all — fail closed, not with an error state.

#### FR-2: Content Extraction
- FR-2.1: Extract the full, current text content of the selected artifact.
- FR-2.2: Extract only the latest revision of a multi-revision artifact by default.
- FR-2.3: Support extracting all artifacts in the current conversation when "Push all" is selected (P1).
- FR-2.4 (edge case): If extracted content is empty or below a minimum length heuristic, block the push and show "Couldn't read artifact content — try reopening the artifact panel" rather than pushing an empty file.
- FR-2.5: Extraction must complete in under 1 second for artifacts up to 500KB of text.

#### FR-3: GitHub Authentication
- FR-3.1: Authenticate via GitHub OAuth Device Flow on first use.
- FR-3.2: Display the device code and verification URL within the extension UI, with a one-click "copy code" action.
- FR-3.3: Poll for token issuance at the interval GitHub specifies in the device code response; stop polling and show "code expired, try again" if the code lapses (typically 15 minutes).
- FR-3.4: Store the resulting token in session-scoped storage only.
- FR-3.5: Detect an expired/revoked token (401 response) and prompt re-authentication with a clear message, not a raw error.
- FR-3.6: Provide a manual "sign out" action that clears the stored token immediately.
- FR-3.7 (edge case): If the user denies the device authorization on GitHub's side, show "Authorization was cancelled" rather than a silent timeout.

#### FR-4: Destination Selection
- FR-4.1: List the authenticated user's accessible repositories, sorted by most recently updated.
- FR-4.2: Allow selecting an existing repo and specifying a target folder path, with autocomplete against the repo's existing tree.
- FR-4.3: Allow creating a new repository — name, description, public/private visibility.
- FR-4.4: Remember the last-used repo + path per Claude conversation/project for repeat pushes (P1).
- FR-4.5 (edge case): If the repo list is empty (new GitHub account), show a clear "Create your first repo" prompt instead of an empty list.
- FR-4.6 (edge case): Validate new repo names against GitHub's naming rules client-side before submission, showing inline validation rather than a failed API call.

#### FR-5: Commit Composition
- FR-5.1: Auto-generate a commit message summarizing the pushed content via an AI call.
- FR-5.2: Allow editing the generated commit message before confirming.
- FR-5.3: Default to creating a new branch and opening a pull request rather than committing directly to the default branch.
- FR-5.4: Allow opting into direct push to the default branch via an explicit toggle, with a one-time confirmation dialog the first time it's used.
- FR-5.5 (edge case): If the AI commit-message call fails or times out (e.g., no Anthropic key configured), fall back to a sensible default message ("Update {filename} via Claude") rather than blocking the push.

#### FR-6: Conflict Handling
- FR-6.1: Check whether the target file path already exists in the destination branch before writing.
- FR-6.2: If the file exists, display a diff between existing and new content before allowing confirmation.
- FR-6.3: If the file was modified on GitHub since last read (sha mismatch at write time), surface a clear conflict warning rather than failing silently or overwriting blind — offer "reload latest and re-diff" as the resolution path.

#### FR-7: Execution & Feedback
- FR-7.1: Execute the push (file create/update, and branch+PR creation if selected) via GitHub's API.
- FR-7.2: Show a loading state during the push operation, with a cancel option if it exceeds 10 seconds.
- FR-7.3: Show a success confirmation with a direct link to the resulting commit or PR on GitHub.
- FR-7.4: Show a specific, actionable error message for each known failure mode:

| Failure | User-facing message | Recovery action offered |
|---|---|---|
| 401 auth expired | "Your GitHub connection expired." | Re-authenticate button |
| 403 rate limited | "GitHub rate limit reached, try again in X minutes." | Auto-retry countdown |
| 403 insufficient scope | "This token can't create private repos — reconnect with full access." | Re-authenticate button |
| 404 repo/path not found | "That repo or folder doesn't exist anymore." | Return to destination picker |
| 409 sha conflict | "This file changed on GitHub since you last saw it." | Reload + re-diff |
| Network failure | "Couldn't reach GitHub — check your connection." | Retry button (auto-retries 3x with backoff first) |
| File too large (>100MB) | "This file is too large to push directly." | Suggests Git LFS externally, blocks push |

#### FR-8: Settings & Preferences
- FR-8.1: Settings panel for: default push mode (branch+PR vs direct), sign-out, clearing remembered repo/path history, Anthropic API key entry (for commit message generation).
- FR-8.2: All preference changes take effect immediately without requiring extension reload.

#### FR-9: Onboarding (new in v2)
- FR-9.1: First install shows a brief (≤3 screen) walkthrough: what the extension does, GitHub connect step, "try it on your next artifact" prompt.
- FR-9.2: Onboarding must be skippable at every step without blocking core functionality.

### 3. Acceptance Criteria — Full Matrix

| Feature | Given | When | Then |
|---|---|---|---|
| Push to new repo | No prior GitHub connection, artifact open | User completes device-flow auth and creates a new repo | Artifact content appears in the repo's default branch (or a PR, per mode) within 30 seconds |
| Push to existing file, no conflict | Target path is empty | User confirms push | File is created, success toast shown with link |
| Push to existing file, conflict | Target path has content | User opens push dialog | Diff is shown before any write occurs; write is blocked until explicit confirm |
| Sha mismatch at write time | File changed on GitHub mid-flow | User confirms push | Conflict warning shown, write blocked, reload+re-diff offered |
| Auth expiry | Stored token has been revoked by GitHub | User attempts a push | Re-authentication prompt shown, not a failed/silent request |
| Empty extraction | Artifact panel fails to yield readable content | User clicks Push to GitHub | Push is blocked with a clear message, no empty file created |
| Rate limit hit | GitHub returns 403 rate-limit response | Any API call | User sees countdown-based retry message, not a raw error |

### 4. Traceability

Every P0 item in this FRD maps to a PRD feature (Section 4) and a TRD implementation section (Sections 3–7). Any new functional requirement added post-launch must be added here first, with acceptance criteria, before implementation — no undocumented functional changes in production.
