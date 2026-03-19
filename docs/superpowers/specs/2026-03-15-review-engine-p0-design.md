# Review Engine P0 Design (Route 2)

Date: 2026-03-15  
Project: review-editor  
Scope: P0 review engine only (no GUI delivery in this phase)

## 1. Objective

Build a long-term-stable review engine foundation for a future GUI product.  
P0 delivers a Rust engine with deterministic rules, stable findings schema, CLI entrypoint, and testable blocking behavior.

## 2. Product Direction and Phase Boundary

- Long-term product: GUI-first review workflow tool.
- Current phase (P0): engine-first, Rust implementation.
- P1 will consume the same findings contract from desktop GUI (`Tauri + React + TypeScript`).

Out of scope in P0:
- GUI screens and interaction flow
- Real agent provider integrations (`codex-cli`, `claude-code`, `gemini-cli`, `opencode`)
- Cross-branch diff modes beyond staged changes

## 3. Architecture (P0)

Monorepo layout (from day 1):

- `crates/review_engine` (Rust core + CLI)
- `apps/desktop` (reserved for P1)
- `schemas/findings.v1.json` (contract source of truth)
- `adapters/agent_provider` (interface + mock only in P0)

Within `crates/review_engine`:

- `src/main.rs`: CLI entry
- `src/lib.rs`: public API for future embedding
- `src/domain/`: `Finding`, `Severity`, `Summary`
- `src/git/`: staged diff ingestion and changed-line mapping
- `src/rules/`: deterministic rule implementations
- `src/engine/`: orchestration and aggregation
- `src/output/`: text/json rendering
- `src/config/`: defaults + CLI mapping

Design principle:
- CLI and engine are separated.
- GUI in P1 should only depend on findings schema and engine API/command contract.

## 4. CLI Contract (P0)

Command:

- `review-engine scan --staged`

Parameters:

- `--repo <path>`: optional; default current working directory
- `--format text|json`: optional; default `text`
- `--block-on error|warning|info|none`: optional; default `error`
- `--max-line-length <n>`: optional; default `120`

Exit codes:

- `0`: no blocking findings
- `1`: one or more blocking findings
- `2`: usage/environment error (bad args, non-git repo, etc.)
- `3`: internal runtime failure

## 5. Findings Contract (`findings.v1`)

Top-level JSON payload (`--format json`):

```json
{
  "schema_version": "findings.v1",
  "repo": "/abs/path",
  "mode": "staged",
  "scanned_at": "2026-03-15T00:00:00Z",
  "summary": {
    "total": 3,
    "by_severity": {"error": 1, "warning": 2, "info": 0},
    "blocking_threshold": "error",
    "blocking_count": 1
  },
  "findings": []
}
```

Finding object:

- `id`: stable hash of `rule_id + file + line + message`
- `rule_id`: rule identifier
- `severity`: `error | warning | info`
- `file`: repository-relative path (`"."` for repo-level finding)
- `line`: integer or `null`
- `title`: short human-readable title
- `message`: detailed explanation
- `suggestion`: optional remediation hint

## 6. Rule Set (P0)

Input scope for all rules: `git diff --cached` only.

### 6.1 `line-too-long`

- Check only added/modified lines from staged diff.
- Trigger when line length `> max_line_length` (default `120`).
- Default severity: `warning`.

### 6.2 `trailing-whitespace`

- Check only added/modified lines from staged diff.
- Trigger on trailing spaces or tabs at line end.
- Default severity: `warning`.

### 6.3 `changed-source-without-changed-tests`

Trigger exactly once per scan when all are true:

- At least one changed source file exists where:
  - path under `src/`, `app/`, or `lib/`, and
  - extension is in code extension allowlist
- No changed test file exists

Test file match (P0): any changed file that matches one of:

- under `tests/` or `__tests__/`
- filename pattern `*.test.*` or `*_test.*`

Pass condition (P0): any test file change is sufficient.  
Default severity: `warning` (explicitly chosen for lower false-positive blocking risk).

## 7. Source/Test Classification (P0 Rules)

Source file classification (strict):

- Path condition AND extension condition both required.

Initial code extension set:

- `.rs`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.java`, `.kt`, `.swift`, `.c`, `.cc`, `.cpp`, `.h`, `.hpp`

Rationale:
- Reduces noisy matches from docs/config-only changes.

## 8. Engine Flow

1. Parse CLI args and resolve repo path.
2. Verify repo and staged mode support.
3. Load staged diff and changed files/lines.
4. Execute line-level rules (6.1, 6.2).
5. Execute repository-level rule (6.3).
6. Aggregate findings + summary.
7. Render output (`text` or `json`).
8. Evaluate blocking threshold and return exit code.

## 9. Error Handling

- Non-git repository: human-readable error + exit code `2`
- No staged changes: zero findings + exit code `0`
- Binary or non-decodable files: skip safely; optionally emit `info` note without blocking
- Internal panic/unexpected state: structured error path + exit code `3`

## 10. Test Strategy

### 10.1 Unit tests

- Rule boundary tests for all 3 rules
- Classification tests for source/test path/extension matching
- Blocking threshold decision tests

### 10.2 Integration tests

- Temporary git repository fixtures
- Stage controlled file edits and run end-to-end scan
- Verify findings content and exit codes

### 10.3 Golden tests

- Stable snapshots for `--format text` and `--format json`

## 11. Delivery Milestones (P0)

- M1: crate skeleton + CLI surface + exit code skeleton
- M2: git staged diff loader
- M3: three-rule implementation
- M4: output renderers + blocking logic
- M5: test hardening + minimal README for engine usage

## 12. Definition of Done (P0)

- Command works with both default repo and `--repo`
- `--format text` default works and readable
- `--format json` conforms to `findings.v1`
- `--block-on` thresholds behave as specified
- All tests pass reliably, including integration and output stability checks

## 13. Forward Compatibility for Agent Integrations

`AgentProvider` is reserved in P0 with mock implementation only.  
Future providers (`codex-cli`, `claude-code`, `gemini-cli`, `opencode`) must emit mapped findings conforming to `findings.v1` and remain optional layers above deterministic rules.

## 14. Open Decisions Deferred to P1+

- GUI interaction model and diff visualization UX
- Rule configuration file format (`review-editor.toml`) and override precedence
- Agent-assisted deep-review ranking/merging strategy
- Multi-branch and PR URL input modes
