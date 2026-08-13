# Functional Requirements Document (FRD)
## nowaygit

### 1. Purpose
Defines exactly what the system must do, function by function, independent of implementation detail (covered in TRD).

### 2. Functional Modules

#### FR-1: Artifact Detection
- FR-1.1: System shall detect when an artifact panel is open in the active claude.ai tab.
- FR-1.2: System shall inject a "Push to GitHub" button into the artifact toolbar without disrupting native claude.ai UI.
- FR-1.3: System shall re-detect artifacts when the user switches between artifact versions/revisions within the same conversation.
- FR-1.4: System shall infer a filename and extension from the artifact's declared type (react → .jsx, html → .html, markdown → .md, python → .py, plaintext → .txt, etc.), with a manual override field.

#### FR-2: Content Extraction
- FR-2.1: System shall extract the full, current text content of the selected artifact.
- FR-2.2: System shall extract only the latest revision of a multi-revision artifact by default.
- FR-2.3: System shall support extracting all artifacts in the current conversation when "Push all" is selected (P1).

#### FR-3: GitHub Authentication
- FR-3.1: System shall authenticate the user via GitHub OAuth Device Flow on first use.
- FR-3.2: System shall display the device code and verification URL to the user within the extension UI.
- FR-3.3: System shall poll for token issuance and store the resulting token in session-scoped storage only.
- FR-3.4: System shall detect an expired/revoked token and prompt re-authentication with a clear message, not a raw 401 error.
- FR-3.5: System shall provide a manual "sign out" action that clears the stored token.

#### FR-4: Destination Selection
- FR-4.1: System shall list the authenticated user's accessible repositories.
- FR-4.2: System shall allow the user to select an existing repo and specify a target folder path (with autocomplete against the repo's existing tree).
- FR-4.3: System shall allow the user to create a new repository, choosing name, description, and public/private visibility.
- FR-4.4: System shall remember the last-used repo + path per Claude conversation/project for repeat pushes (P1).

#### FR-5: Commit Composition
- FR-5.1: System shall auto-generate a commit message summarizing the pushed content via an AI call.
- FR-5.2: System shall allow the user to edit the generated commit message before confirming.
- FR-5.3: System shall default to creating a new branch and opening a pull request rather than committing directly to the default branch.
- FR-5.4: System shall allow the user to opt into direct push to the default branch via an explicit toggle.

#### FR-6: Conflict Handling
- FR-6.1: System shall check whether the target file path already exists in the destination branch before writing.
- FR-6.2: If the file exists, system shall display a diff between the existing content and the new content before allowing confirmation.
- FR-6.3: If the file was modified on GitHub since the extension last read it (sha mismatch), system shall surface a clear conflict warning rather than failing silently or overwriting blind.

#### FR-7: Execution & Feedback
- FR-7.1: System shall execute the push (file create/update, and branch+PR creation if selected) via GitHub's API.
- FR-7.2: System shall show a loading state during the push operation.
- FR-7.3: System shall show a success confirmation with a direct link to the resulting commit or PR on GitHub.
- FR-7.4: System shall show a specific, actionable error message for each known failure mode: auth expired, rate limited, repo not found, network failure, file too large.

#### FR-8: Settings & Preferences
- FR-8.1: System shall provide a settings panel for: default push mode (branch+PR vs direct), sign-out, and clearing remembered repo/path history.

### 3. Non-Functional Requirements (cross-reference)
See TRD for performance, security, and reliability requirements tied to these functions.

### 4. Acceptance Criteria (per P0 feature)

| Feature | Acceptance Criteria |
|---|---|
| Push single artifact to new repo | Given an open artifact and no prior GitHub connection, when the user completes device-flow auth and creates a new repo, then the artifact content appears in that repo's default branch (or a PR, per selected mode) within 30 seconds. |
| Push to existing file path | Given a target path that already contains a file, when the user confirms the push, then a diff is shown before any write occurs. |
| Auth expiry handling | Given a previously stored token that GitHub has revoked, when the user attempts a push, then the system shows a re-authentication prompt rather than a failed/silent request. |
