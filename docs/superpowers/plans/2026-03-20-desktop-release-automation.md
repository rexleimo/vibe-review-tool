# Desktop Release Automation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tag-driven GitHub Release automation for the Tauri desktop app, including cross-platform installers, version/tag validation, and reusable PR/Release note content.

**Architecture:** Keep release behavior deterministic by validating the pushed tag against `apps/desktop/src-tauri/tauri.conf.json` before invoking the Tauri release action, while also enforcing that `apps/desktop/package.json` and `apps/desktop/src-tauri/Cargo.toml` stay version-aligned. Store prose assets as repo files so the workflow and PR text stay editable in version control, and resolve the versioned release note file from the pushed tag at workflow runtime.

**Tech Stack:** GitHub Actions, Tauri v2, Node.js, YAML workflow, node:test

---

## File Map

- Create: `.github/workflows/release-desktop.yml`
- Create: `.github/release-notes/desktop-v0.1.0.md`
- Create: `.github/pull_request_template.md`
- Create: `apps/desktop/scripts/assert-release-version.mjs`
- Create: `apps/desktop/tests/releaseVersion.test.mjs`
- Modify: `apps/desktop/package.json`

## Chunk 1: Version Gate

- [ ] Add a failing test for tag/version validation script
- [ ] Implement minimal script reading `GITHUB_REF_NAME` + `tauri.conf.json`
- [ ] Enforce `package.json` and `src-tauri/Cargo.toml` version alignment with the Tauri config version
- [ ] Fail fast when `.github/release-notes/desktop-${tag}.md` is missing
- [ ] Re-run targeted test until green

## Chunk 2: Release Workflow

- [ ] Add tag-triggered GitHub Actions workflow for `v*` tags
- [ ] Validate version before release build
- [ ] Use `projectPath: apps/desktop` so the workflow builds the desktop app from the repo subdirectory
- [ ] Run `npm ci` inside `apps/desktop`, not the repo root
- [ ] Install Linux Tauri bundle dependencies on the Ubuntu runner before build
- [ ] Build Windows/macOS/Linux bundles with `tauri-apps/tauri-action`
- [ ] Read the tracked release note markdown into `releaseBody` before publishing the release

## Chunk 3: Repo Templates And Verification

- [ ] Add GitHub PR template with this change summary structure
- [ ] Add tracked release note markdown for current release line
- [ ] Verify tests, build, and inspect workflow YAML/stat
