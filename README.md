# nowaygit

A Chrome extension that lets anyone working in claude.ai push generated artifacts (code, markdown, config files, whole conversation outputs) straight to a GitHub repository — new or existing — without manually copying, downloading, or zipping files.

## Why

Claude.ai has no native "push to GitHub" capability. Export is limited to one artifact at a time, with no folder structure and no git awareness. Competing AI builders (v0, Bolt.new, Lovable) already ship native GitHub sync. This extension closes that gap for Claude.ai users.

## Core Flow

1. Open any conversation in claude.ai that has one or more artifacts.
2. Click **Push to GitHub** in the artifact toolbar (or "Push all" from the conversation menu for multi-file pushes).
3. First time only: authenticate with GitHub via Device Flow (enter an 8-character code at github.com/login/device — no password or secret ever touches the extension).
4. Pick a destination: an existing repo + folder path, or create a new repo (public/private).
5. Review the auto-generated commit message (AI-written, editable) and the diff if updating an existing file.
6. Choose **push directly** or **create branch + PR** (default, safer).
7. Get a confirmation toast with a link to the commit/PR on GitHub.

## Who It's For

- Indie builders and vibe-coders who prototype in claude.ai and want their output under version control without leaving the chat.
- Non-technical users who want a one-click way to "save this to GitHub" without knowing git commands.
- Teams who want an audit trail of AI-generated code before it enters a real codebase (via the PR-first default).

## What This Is Not

- Not a replacement for Claude Code or the official Claude GitHub App — those are for people already working inside a GitHub-centric dev loop with repo context. This tool is for people working inside claude.ai chat/artifacts who want an exit ramp to GitHub.
- Not a full CI/CD or deployment tool in v1 (see Roadmap below for planned Vercel deploy trigger).

## Repo / Doc Structure

- `README.md` — this file
- `BRD.md` — Business Requirements Document
- `PRD.md` — Product Requirements Document
- `FRD.md` — Functional Requirements Document
- `TRD.md` — Technical Requirements Document

## Roadmap Snapshot (post-MVP)

- Auto-generated README.md for pushed projects
- Round-trip: pull an existing repo file into a Claude conversation as context
- Trigger a Vercel deploy after push (fits Himxu's own monorepo workflow)
- GitLab/Bitbucket support
- "Watch mode" — auto-sync on every artifact revision

## Status

Pre-build. This documentation set (BRD/PRD/FRD/TRD) is the planning baseline before implementation starts.
