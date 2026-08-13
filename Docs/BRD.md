# Business Requirements Document (BRD)
## nowaygit

### 1. Purpose

Define the business rationale, scope boundaries, stakeholders, and success criteria for building a Chrome extension that pushes claude.ai-generated content directly to GitHub.

### 2. Background & Problem Statement

Claude.ai has no native mechanism to move artifact content into version control. Users currently must manually copy or download each artifact, then handle git themselves. This friction is validated by:

- An open, unresolved issue on Anthropic's own repo (`anthropics/claude-code#28161`) describing broken/incomplete export UX.
- No per-project or per-artifact export in claude.ai; the only first-party export is a compliance-driven account-wide JSON dump, not designed for portability.
- Direct competitive precedent: v0.dev, Bolt.new, and Lovable all ship native GitHub sync. Claude.ai does not.
- A proven third-party pattern: the "Bolt to GitHub" Chrome extension exists specifically because Bolt.new lacked this feature — evidence that users will adopt a browser-extension bridge when the underlying platform doesn't provide one.

### 3. Business Objectives

| Objective | Metric |
|---|---|
| Reduce time-to-repo for AI-generated code | From "copy/paste + manual git init" (~5–10 min) to under 60 seconds |
| Drive extension adoption among claude.ai power users | Chrome Web Store installs, weekly active pushers |
| Establish a defensible niche before Anthropic or a competitor closes the gap natively | Ship MVP before this becomes a commodity feature |
| Create a foundation for monetizable add-ons | Convert free-tier single-file push users into paid whole-project/PR/deploy-trigger users |

### 4. Stakeholders

- **Builder/Owner (Himxu):** product owner, sole developer, primary user (dogfoods via own EssmartCreator/meImposter/YouTube-to-social projects).
- **End users:** indie developers, non-technical builders, small teams using claude.ai for prototyping.
- **Anthropic (indirect/passive):** platform owner; not a partner, but the ToS risk (Section 6) means their policies constrain design choices.
- **GitHub (indirect/passive):** API provider; rate limits and OAuth model constrain design choices.

### 5. Scope

**In scope (MVP):**
- Single-artifact push (create/update file) to a new or existing GitHub repo.
- GitHub authentication via Device Flow.
- Branch + PR default push mode, with direct-push override.
- AI-generated, editable commit messages.

**Out of scope (MVP), planned later:**
- Multi-file / whole-conversation push (Git Data API — higher complexity, phase 2).
- Deployment triggers (Vercel/Netlify).
- Round-trip import from GitHub into a conversation.
- Non-GitHub git hosts.
- Teams/organization billing.

### 6. Business Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Reliance on undocumented Claude.ai internal API for extraction | Anthropic could break or restrict it; possible ToS conflict | Default to DOM-based extraction (Section 2 of prior validation doc); treat internal-API method as optional, disclosed fallback only |
| Anthropic ships this natively | Product becomes redundant | Ship fast; differentiate on PR-first safety, monorepo path targeting, AI commit messages — features unlikely to be Anthropic's first pass |
| GitHub API rate limits / policy changes | Service disruption for heavy users | Design within documented 5,000 req/hr authenticated limit; no scraping of GitHub itself |
| Chrome Web Store review rejection (permissions scope) | Delayed launch | Request only `identity`, `storage`, and host permission for `claude.ai`; avoid broad `<all_urls>` |
| Low willingness to pay | Weak monetization | Start free, single-file push; gate whole-project push / deploy triggers / auto-README behind a paid tier once usage is proven |

### 7. Success Criteria (MVP)

- A user can go from "artifact open in claude.ai" to "file live on GitHub" in under 60 seconds, first-time auth included.
- Zero silent overwrites (every existing-file push either goes through a diff+PR or an explicit confirmation).
- Extraction accuracy: pushed file content matches the artifact's final rendered version 100% of the time in manual QA across text, code, and markdown artifact types.

### 8. Assumptions

- Users already have (or are willing to create) a GitHub account.
- Users are using claude.ai on desktop Chrome (not mobile) for the extension itself, since Chrome extensions don't run on Claude's mobile app.
- Anthropic does not explicitly prohibit content-script-based UI injection into claude.ai (standard practice among existing exporter extensions).

### 9. Constraints

- Manifest V3 only (Chrome Web Store requirement as of 2026).
- No backend server in MVP — fully client-side to keep costs at zero and avoid holding user credentials server-side.
