# Review-Editor Bootstrap Plan

Date: `2026-03-15`
Task: `task_20260314T234632_bootstrap_guidelines`

## Baseline Confirmed

- Working directory is a ContextDB workspace, not a git repository yet.
- Active constraints were taken from `AGENTS.md` (skill-first workflow, safe edits, verification-before-claims).
- Existing session checkpoint was found and validated under `memory/context-db/sessions/`.

## Guidance Artifact Outcome

This file serves as the initial guidance baseline requested by bootstrap:

- Records the current workspace structure and task state.
- Makes the next engineering objective explicit and scoped.
- Provides acceptance criteria that can be verified by commands.

## Next Concrete Engineering Task

Task ID: `task_20260315T060000_review_editor_mvp`

Objective:
Build the first executable MVP slice of `review-editor` as a local CLI that:

1. Accepts one markdown input file path.
2. Outputs structured JSON review items to stdout.
3. Ships with at least one automated test proving the CLI contract.

Scope boundaries:

- Focus only on local CLI execution (no web UI, no network calls).
- Keep the rule set minimal (at least one concrete review rule).
- Prefer deterministic output and fixed schema.

## Acceptance Criteria For The Next Task

1. `review-editor` CLI command (or equivalent local entrypoint) runs with a markdown file argument.
2. Output is valid JSON with a stable top-level schema.
3. At least one failing-then-passing automated test exists for core behavior.
4. A short README section documents how to run CLI + tests.

## ContextDB Evidence

- Session: `codex-cli-20260314T234633-73b537dc`
- Checkpoint sequence `2` records bootstrap completion summary and next actions.
