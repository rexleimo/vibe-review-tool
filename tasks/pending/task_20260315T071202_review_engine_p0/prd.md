# Task: Review Engine P0 (Rust)

## Context

- Project: `review-editor`
- Task ID: `task_20260315T071202_review_engine_p0`
- Spec: `docs/superpowers/specs/2026-03-15-review-engine-p0-design.md`
- Plan: `docs/superpowers/plans/2026-03-15-review-engine-p0-implementation.md`

## Goal

Implement P0 deterministic review engine in Rust with staged diff scanning, three initial rules, text/json output, and configurable blocking exit behavior.

## Definition of Done

- [x] CLI `scan --staged` works with default repo and `--repo`.
- [x] Three rules implemented and tested.
- [x] `findings.v1` JSON output stable.
- [x] Blocking threshold behavior verified by tests.
