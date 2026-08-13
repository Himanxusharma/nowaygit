# Product Requirements Document (PRD)
## nowaygit

### 1. Product Vision

A one-click bridge, living as a Chrome extension, between claude.ai's artifact panel and GitHub — so anything a user builds in a Claude conversation can land in a real, versioned repository without leaving the chat.

### 2. Target Users & Personas

**Persona 1 — Indie Builder (primary, matches Himxu's own workflow)**
Prototypes features, scripts, and configs inside claude.ai across multiple side projects. Wants generated code under version control immediately, ideally dropped into the right folder of an existing monorepo.

**Persona 2 — Non-technical Creator**
Uses Claude to generate landing pages, READMEs, or simple scripts. Doesn't know git commands. Wants a "Save to GitHub" button that behaves like Save to Drive.

**Persona 3 — Team Reviewer**
Wants AI-generated code to enter the codebase through a reviewable PR, not a silent commit to main.

### 3. User Stories

- As an indie builder, I want to push the artifact I'm looking at to a specific folder in my existing monorepo, so I don't have to manually relocate files after downloading.
- As a non-technical creator, I want to create a brand-new GitHub repo directly from the extension, so I don't need to use GitHub's website first.
- As a team reviewer, I want every push to default to a branch + PR, so nothing lands on main without review.
- As any user, I want an AI-written commit message pre-filled (and editable), so I don't have to write one myself.
- As a returning user, I want the extension to remember my last-used repo and path, so repeat pushes are one click.
- As a cautious user, I want to see a diff before overwriting an existing file, so I don't lose work by accident.

### 4. Feature List & Prioritization

**P0 (MVP — must ship)**
- Single-artifact detection + "Push to GitHub" button in artifact toolbar
- GitHub Device Flow authentication
- Repo picker (existing repo + path, or create new)
- Public/private toggle on repo creation
- Branch + PR default push, direct-push override
- AI-generated, editable commit message
- Success/error toast with link to result

**P1 (fast follow)**
- Diff preview before overwriting an existing file
- Remember last-used repo/path per Claude project
- Whole-conversation / multi-artifact push (folder structure in one push)
- Auto-generated README.md for pushed projects

**P2 (later)**
- Round-trip import: pull a GitHub file into a Claude conversation as context
- Deploy trigger (Vercel) after push
- Watch mode: auto-push on every artifact revision
- GitLab/Bitbucket support

### 5. Out of Scope

- Editing GitHub files from within the extension (one-directional push/pull only, not a full editor)
- Claude Code / official GitHub App overlap — this tool serves chat/artifact users, not repo-embedded workflows
- Mobile support (Chrome extensions do not run in the Claude mobile app)

### 6. UX Principles

- **Never silently overwrite.** Every write to an existing file path must show a diff or go through a PR.
- **One click for repeat use.** After first setup, pushing to the same destination should take one click plus a confirm.
- **No dead ends.** Every error state (auth expired, rate limit hit, repo not found) shows a clear next action, not a raw API error.
- **Minimal footprint.** The injected UI should look native to claude.ai's design language, not like a bolted-on toolbar.

### 7. Success Metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Weekly active users who complete at least 1 push | Baseline + track growth |
| Median time from click to confirmed push | < 30 seconds (excluding first-time auth) |
| % of pushes using branch+PR vs direct | Track — informs whether default should flip |
| Uninstall rate within 7 days | < 20% |

### 8. Dependencies

- GitHub REST API (Contents API, Git Data API, Device Flow OAuth endpoints)
- Claude API (for AI-generated commit messages / auto-README — reuses existing Anthropic API access)
- Chrome Extension platform (Manifest V3)
