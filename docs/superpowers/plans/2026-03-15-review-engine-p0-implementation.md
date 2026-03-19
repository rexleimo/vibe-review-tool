# Review Engine P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Rust `review-engine` CLI that scans `git diff --cached`, applies deterministic review rules, and reports blocking status via configurable severity thresholds.

**Architecture:** Use a monorepo with `crates/review_engine` as the Rust core. Keep CLI parsing, git diff loading, rule execution, and rendering in separate modules behind a stable `findings.v1` contract in `schemas/`. Reserve `apps/desktop` and `adapters/agent_provider` for future phases while keeping P0 focused on engine correctness and repeatability.

**Tech Stack:** Rust 1.86, Cargo workspace, `clap`, `serde`, `serde_json`, `anyhow`, `thiserror`, `assert_cmd`, `predicates`, `tempfile`.

---

## File Structure Map

Create these files in P0:

- `Cargo.toml`
- `crates/review_engine/Cargo.toml`
- `crates/review_engine/src/main.rs`
- `crates/review_engine/src/lib.rs`
- `crates/review_engine/src/config/mod.rs`
- `crates/review_engine/src/domain/mod.rs`
- `crates/review_engine/src/engine/mod.rs`
- `crates/review_engine/src/git/mod.rs`
- `crates/review_engine/src/output/mod.rs`
- `crates/review_engine/src/rules/mod.rs`
- `crates/review_engine/src/rules/line_too_long.rs`
- `crates/review_engine/src/rules/trailing_whitespace.rs`
- `crates/review_engine/src/rules/source_without_tests.rs`
- `crates/review_engine/src/rules/classification.rs`
- `crates/review_engine/tests/cli_help.rs`
- `crates/review_engine/tests/json_contract.rs`
- `crates/review_engine/tests/git_staged_loader.rs`
- `crates/review_engine/tests/rule_line_checks.rs`
- `crates/review_engine/tests/rule_source_without_tests.rs`
- `crates/review_engine/tests/cli_scan_exit_codes.rs`
- `schemas/findings.v1.json`
- `apps/desktop/README.md`
- `adapters/agent_provider/README.md`
- `README.md` (update)

Keep unchanged in P0:

- Existing Python prototype files under `review_editor/` and `tests/` (leave as legacy; do not delete in this phase).

---

## Chunk 1: Workspace and Contract Skeleton

### Task 1: Bootstrap Rust Workspace and CLI Surface

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `Cargo.toml`
- Create: `crates/review_engine/Cargo.toml`
- Create: `crates/review_engine/src/main.rs`
- Create: `crates/review_engine/src/lib.rs`
- Create: `crates/review_engine/tests/cli_help.rs`
- Create: `apps/desktop/README.md`
- Create: `adapters/agent_provider/README.md`

- [ ] **Step 1: Write failing CLI help test**

```rust
#[test]
fn cli_help_shows_scan_subcommand() {
    let mut cmd = assert_cmd::Command::cargo_bin("review-engine").unwrap();
    cmd.arg("--help");
    cmd.assert().success().stdout(predicates::str::contains("scan"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p review_engine --test cli_help cli_help_shows_scan_subcommand -- --exact`
Expected: FAIL because binary/CLI is not implemented yet.

- [ ] **Step 3: Implement minimal workspace + CLI skeleton**

```rust
#[derive(clap::Parser)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(clap::Subcommand)]
enum Commands {
    Scan {
        #[arg(long)]
        staged: bool,
    },
}
```

- [ ] **Step 4: Re-run test to verify pass**

Run: `cargo test -p review_engine --test cli_help cli_help_shows_scan_subcommand -- --exact`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml crates/review_engine apps/desktop/README.md adapters/agent_provider/README.md
git commit -m "chore: bootstrap rust workspace and review-engine CLI shell"
```

### Task 2: Define Domain Types and Findings JSON Contract

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/domain/mod.rs`
- Create: `crates/review_engine/src/config/mod.rs`
- Create: `schemas/findings.v1.json`
- Create: `crates/review_engine/tests/json_contract.rs`
- Modify: `crates/review_engine/src/lib.rs`

- [ ] **Step 1: Write failing JSON contract test**

```rust
#[test]
fn json_payload_contains_required_top_level_fields() {
    let payload = review_engine::empty_scan_payload("/tmp/repo", "error");
    let v = serde_json::to_value(payload).unwrap();
    assert_eq!(v["schema_version"], "findings.v1");
    assert!(v.get("summary").is_some());
    assert!(v.get("findings").is_some());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p review_engine --test json_contract json_payload_contains_required_top_level_fields -- --exact`
Expected: FAIL because domain payload API does not exist yet.

- [ ] **Step 3: Implement minimal serializable domain model**

```rust
#[derive(Serialize)]
pub struct ScanResult {
    pub schema_version: &'static str,
    pub repo: String,
    pub mode: &'static str,
    pub scanned_at: String,
    pub summary: Summary,
    pub findings: Vec<Finding>,
}
```

- [ ] **Step 4: Re-run test to verify pass**

Run: `cargo test -p review_engine --test json_contract json_payload_contains_required_top_level_fields -- --exact`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/domain/mod.rs crates/review_engine/src/config/mod.rs crates/review_engine/src/lib.rs schemas/findings.v1.json crates/review_engine/tests/json_contract.rs
git commit -m "feat: add findings v1 domain model and contract file"
```

## Chunk 2: Diff Ingestion and Rule Engine

### Task 3: Implement Staged Diff Loader

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/git/mod.rs`
- Create: `crates/review_engine/tests/git_staged_loader.rs`
- Modify: `crates/review_engine/src/lib.rs`

- [ ] **Step 1: Write failing integration test for staged diff ingestion**

```rust
#[test]
fn loads_changed_files_and_added_lines_from_staged_diff() {
    // temp repo fixture:
    // init git, create file, stage changes, call loader
    // assert file path and changed line numbers are returned
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p review_engine --test git_staged_loader loads_changed_files_and_added_lines_from_staged_diff -- --exact`
Expected: FAIL because staged diff loader is missing.

- [ ] **Step 3: Implement git module using `git -C <repo> diff --cached --unified=0`**

```rust
pub fn load_staged(repo: &Path) -> Result<StagedDiff> {
    // execute git command
    // parse file headers and @@ hunks
    // map added/modified target line numbers
}
```

- [ ] **Step 4: Re-run test to verify pass**

Run: `cargo test -p review_engine --test git_staged_loader loads_changed_files_and_added_lines_from_staged_diff -- --exact`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/git/mod.rs crates/review_engine/src/lib.rs crates/review_engine/tests/git_staged_loader.rs
git commit -m "feat: add staged diff loader for cached git changes"
```

### Task 4: Implement Line-Level Rules

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/rules/mod.rs`
- Create: `crates/review_engine/src/rules/line_too_long.rs`
- Create: `crates/review_engine/src/rules/trailing_whitespace.rs`
- Create: `crates/review_engine/tests/rule_line_checks.rs`

- [ ] **Step 1: Write failing tests for both line rules**

```rust
#[test]
fn line_too_long_flags_added_lines_over_threshold() {}

#[test]
fn trailing_whitespace_flags_added_lines_with_suffix_spaces_or_tabs() {}
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cargo test -p review_engine --test rule_line_checks`
Expected: FAIL because rule modules are not implemented.

- [ ] **Step 3: Implement minimal line rule evaluators**

```rust
pub fn evaluate_line_too_long(changed_line: &ChangedLine, max: usize) -> Option<Finding>;
pub fn evaluate_trailing_whitespace(changed_line: &ChangedLine) -> Option<Finding>;
```

- [ ] **Step 4: Re-run tests to verify pass**

Run: `cargo test -p review_engine --test rule_line_checks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/rules crates/review_engine/tests/rule_line_checks.rs
git commit -m "feat: add line-too-long and trailing-whitespace rules"
```

### Task 5: Implement `changed-source-without-changed-tests`

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/rules/classification.rs`
- Create: `crates/review_engine/src/rules/source_without_tests.rs`
- Create: `crates/review_engine/tests/rule_source_without_tests.rs`
- Modify: `crates/review_engine/src/rules/mod.rs`

- [ ] **Step 1: Write failing tests for source/test classification and rule trigger**

```rust
#[test]
fn triggers_when_source_changed_but_no_test_files_changed() {}

#[test]
fn does_not_trigger_when_any_test_file_changed() {}
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cargo test -p review_engine --test rule_source_without_tests`
Expected: FAIL because classifier/rule is missing.

- [ ] **Step 3: Implement strict source classification and test detection**

```rust
pub fn is_source_file(path: &str) -> bool; // path prefix + extension
pub fn is_test_file(path: &str) -> bool;   // tests dirs or *.test.* / *_test.*
```

- [ ] **Step 4: Re-run tests to verify pass**

Run: `cargo test -p review_engine --test rule_source_without_tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/rules crates/review_engine/tests/rule_source_without_tests.rs
git commit -m "feat: add source-without-tests repository-level rule"
```

## Chunk 3: Orchestration, Output, and Verification

### Task 6: Implement Engine Orchestration and Blocking Thresholds

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/engine/mod.rs`
- Modify: `crates/review_engine/src/lib.rs`
- Modify: `crates/review_engine/src/config/mod.rs`
- Create: `crates/review_engine/tests/cli_scan_exit_codes.rs`

- [ ] **Step 1: Write failing tests for `--block-on` exit-code behavior**

```rust
#[test]
fn returns_exit_1_when_blocking_findings_exist() {}

#[test]
fn returns_exit_0_when_findings_below_threshold() {}
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cargo test -p review_engine --test cli_scan_exit_codes`
Expected: FAIL because threshold logic is not implemented.

- [ ] **Step 3: Implement orchestration pipeline + threshold evaluator**

```rust
pub fn run_scan(config: ScanConfig) -> Result<ScanResult>;
pub fn compute_exit_code(result: &ScanResult, block_on: Severity) -> i32;
```

- [ ] **Step 4: Re-run tests to verify pass**

Run: `cargo test -p review_engine --test cli_scan_exit_codes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/engine/mod.rs crates/review_engine/src/lib.rs crates/review_engine/src/config/mod.rs crates/review_engine/tests/cli_scan_exit_codes.rs
git commit -m "feat: add scan orchestration and block-on exit logic"
```

### Task 7: Implement Text/JSON Renderers and CLI Integration

**Skill refs:** `@superpowers/test-driven-development`, `@superpowers/verification-before-completion`

**Files:**
- Create: `crates/review_engine/src/output/mod.rs`
- Modify: `crates/review_engine/src/main.rs`
- Modify: `crates/review_engine/src/lib.rs`
- Create: `crates/review_engine/tests/cli_output_formats.rs`

- [ ] **Step 1: Write failing format tests for default text and `--format json`**

```rust
#[test]
fn default_output_is_text_report() {}

#[test]
fn json_output_contains_findings_v1_schema() {}
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cargo test -p review_engine --test cli_output_formats`
Expected: FAIL because renderer wiring is incomplete.

- [ ] **Step 3: Implement renderer module and wire CLI output path**

```rust
pub fn render_text(result: &ScanResult) -> String;
pub fn render_json(result: &ScanResult) -> String;
```

- [ ] **Step 4: Re-run tests to verify pass**

Run: `cargo test -p review_engine --test cli_output_formats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/review_engine/src/output/mod.rs crates/review_engine/src/main.rs crates/review_engine/src/lib.rs crates/review_engine/tests/cli_output_formats.rs
git commit -m "feat: add text and json output renderers"
```

### Task 8: Full Verification Sweep and Documentation

**Skill refs:** `@superpowers/verification-before-completion`

**Files:**
- Modify: `README.md`
- Modify: `crates/review_engine/Cargo.toml` (if test/dev dependencies need cleanup)

- [ ] **Step 1: Update README with usage and exit-code table**

```markdown
cargo run -p review_engine -- scan --staged
cargo run -p review_engine -- scan --staged --format json
cargo run -p review_engine -- scan --staged --block-on warning
```

- [ ] **Step 2: Run complete test suite**

Run: `cargo test -p review_engine`
Expected: PASS with all unit/integration tests green.

- [ ] **Step 3: Run CLI smoke checks manually**

Run:
- `cargo run -p review_engine -- scan --staged --format text`
- `cargo run -p review_engine -- scan --staged --format json`

Expected: valid report output, correct exit behavior.

- [ ] **Step 4: Verify `findings.v1` sample output matches schema file**

Run: `cargo run -p review_engine -- scan --staged --format json > /tmp/findings.json`
Expected: field names and enums align with `schemas/findings.v1.json`.

- [ ] **Step 5: Commit**

```bash
git add README.md schemas/findings.v1.json crates/review_engine
git commit -m "docs: finalize review-engine p0 usage and verification"
```

---

## Execution Notes

- If this workspace is not a git repository, initialize it once before task commits:

```bash
git init
git add .
git commit -m "chore: baseline before review-engine p0"
```

- If a task fails repeatedly, stop and ask for clarification instead of skipping checks.
- Do not start GUI implementation in P0; keep all code changes under engine and schema scope.

## Plan Review Checklist

Before executing:

- [ ] Paths in each task exist or are intentionally created.
- [ ] Each task starts with a failing test.
- [ ] Each task includes explicit verification command(s).
- [ ] `--staged`, `--format`, and `--block-on` contracts are covered by tests.
- [ ] Scope remains P0 engine-only.
