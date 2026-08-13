# Product Requirements Document (PRD) — Production
## Claude → GitHub Bridge
**Version 2.0 — Production-Ready**

---

### 1. Product Vision

A one-click bridge, living as a Chrome extension, between claude.ai's artifact panel and GitHub — so anything a user builds in a Claude conversation can land in a real, versioned repository without leaving the chat.

### 2. Target Users & Personas

**Persona 1 — Indie Builder (primary)**
Prototypes features, scripts, and configs inside claude.ai across multiple side projects. Wants generated code under version control immediately, ideally dropped into the right folder of an existing monorepo.

**Persona 2 — Non-technical Creator**
Uses Claude to generate landing pages, READMEs, or simple scripts. Doesn't know git commands. Wants a "Save to GitHub" button that behaves like Save to Drive.

**Persona 3 — Team Reviewer**
Wants AI-generated code to enter the codebase through a reviewable PR, not a silent commit to main.

### 3. User Stories (with acceptance criteria folded in — see FRD for full traceability)

- As an indie builder, I want to push the artifact I'm looking at to a specific folder in my existing monorepo, so I don't have to manually relocate files after downloading.
- As a non-technical creator, I want to create a brand-new GitHub repo directly from the extension, so I don't need to use GitHub's website first.
- As a team reviewer, I want every push to default to a branch + PR, so nothing lands on main without review.
- As any user, I want an AI-written commit message pre-filled (and editable), so I don't have to write one myself.
- As a returning user, I want the extension to remember my last-used repo and path, so repeat pushes are one click.
- As a cautious user, I want to see a diff before overwriting an existing file, so I don't lose work by accident.
- As a first-time user, I want a guided first-run experience (auth + first push) that takes under 2 minutes, so I don't abandon setup.
- As any user, I want to know clearly when something failed and why, so I'm never left guessing whether my push succeeded.

### 4. Feature List & Prioritization

**P0 — MVP (must ship, blocks launch)**
- Artifact detection + "Push to GitHub" button in artifact toolbar
- GitHub Device Flow authentication + secure token storage
- Repo picker (existing repo + path, or create new, public/private toggle)
- Branch + PR default push, direct-push override
- AI-generated, editable commit message
- Conflict detection (existing file) with diff view before confirming
- Success/error toast with deep link to result
- Onboarding flow (first-run auth + first-push walkthrough)
- Settings panel (sign out, default push mode, clear history)

**P1 — Fast follow (within 4–6 weeks of launch)**
- Remember last-used repo/path per Claude conversation
- Whole-conversation / multi-artifact push (folder structure in one push)
- Auto-generated README.md for pushed projects
- Basic in-extension analytics opt-in (push success/failure counts only, no content)

**P2 — Later**
- Round-trip import: pull a GitHub file into a Claude conversation as context
- Deploy trigger (Vercel) after push
- Watch mode: auto-push on every artifact revision
- GitLab/Bitbucket support
- Team/org shared destination presets

### 5. Out of Scope (explicit, to prevent scope creep)

- Editing GitHub files from within the extension (one-directional push/pull only, never a full editor)
- Claude Code / official GitHub App overlap — this serves chat/artifact users, not repo-embedded workflows
- Mobile support (Chrome extensions do not run in the Claude mobile app)
- Any server-side storage of user artifact content (privacy-by-design constraint, see TRD Security)
- Support for git hosts other than GitHub until P2

### 6. UX Principles

- **Never silently overwrite.** Every write to an existing file path must show a diff or go through a PR.
- **One click for repeat use.** After first setup, pushing to the same destination should take one click plus a confirm.
- **No dead ends.** Every error state (auth expired, rate limit hit, repo not found) shows a clear next action, not a raw API error.
- **Minimal footprint.** The injected UI should look native to claude.ai's design language, not like a bolted-on toolbar.
- **Reversible by default.** Branch+PR as default push mode means every AI-authored change is reviewable before it's permanent.

### 7. Non-Functional Requirements (Product-Level)

| Category | Requirement |
|---|---|
| Performance | Push flow (click → confirmation) completes in under 5 seconds excluding GitHub API latency and user review time |
| Accessibility | Injected UI and popup meet WCAG 2.1 AA — keyboard-navigable, screen-reader labeled, sufficient color contrast |
| Privacy | No artifact content or GitHub token ever leaves the user's browser except to GitHub's/Anthropic's own APIs; no first-party telemetry captures content |
| Localization | English only at launch; UI strings externalized into a single resource file so translation is a config change, not a rewrite |
| Browser support | Chrome and Chromium-based browsers (Edge, Brave) supporting Manifest V3; Firefox port explicitly out of scope for v1 |

### 8. Release Criteria (Go/No-Go for launch)

- All P0 features pass acceptance criteria in FRD.
- Zero P0/P1-severity bugs open (see TRD QA section for severity definitions).
- Manual QA checklist (TRD Section 8) completed on a real GitHub account against public and private repos.
- Chrome Web Store listing approved (privacy policy, permissions justification submitted).
- Rollback plan confirmed: previous version can be re-published within 1 hour if a critical bug ships.

### 9. Success Metrics (post-launch, 90 days)

| Metric | Target |
|---|---|
| Weekly active users completing ≥1 push | Track against install count; target >30% WAU/installs |
| Median time from click to confirmed push (repeat use) | < 15 seconds |
| First-push completion rate (installs → first successful push) | > 60% |
| % of pushes using branch+PR vs direct | Track — informs default review |
| Uninstall rate within 7 days | < 20% |
| Support-ticket rate (errors reported / total pushes) | < 2% |

### 10. Dependencies

- GitHub REST API (Contents API, Git Data API, Device Flow OAuth endpoints) — no SLA, subject to GitHub's own rate limits and outages.
- Anthropic API (commit message / README generation) — user-supplied key, no product-owned billing liability in v1.
- Chrome Extension platform (Manifest V3) — subject to Chrome Web Store review and policy changes.
- Claude.ai's DOM structure — not a formal dependency (no contract with Anthropic), but extraction correctness is coupled to it; see TRD risk section.
