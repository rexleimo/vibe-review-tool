use std::fs;
use std::path::Path;
use std::process::Command;

use assert_cmd::Command as AssertCommand;
use serde_json::Value;
use tempfile::TempDir;

fn run_git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .status()
        .expect("git command should start");
    assert!(status.success(), "git command failed: git {:?}", args);
}

fn setup_repo_with_long_line() -> TempDir {
    let temp = TempDir::new().expect("temp dir");
    let repo = temp.path();

    run_git(repo, &["init"]);
    run_git(repo, &["config", "user.email", "test@example.com"]);
    run_git(repo, &["config", "user.name", "Tester"]);

    let src = repo.join("src/main.rs");
    fs::create_dir_all(src.parent().expect("parent")).expect("mkdir");
    fs::write(&src, "fn main() {}\n").expect("write");
    run_git(repo, &["add", "."]);
    run_git(repo, &["commit", "-m", "init"]);

    fs::write(&src, format!("fn main() {{\n    let a = \"{}\";\n}}\n", "x".repeat(130))).expect("write changed");
    run_git(repo, &["add", "src/main.rs"]);

    temp
}

#[test]
fn default_output_is_text_report() {
    let temp = setup_repo_with_long_line();

    let mut cmd = AssertCommand::cargo_bin("review-engine").expect("binary exists");
    cmd.args(["scan", "--staged", "--repo"])
        .arg(temp.path())
        .assert()
        .code(0)
        .stdout(predicates::str::contains("line-too-long"));
}

#[test]
fn json_output_contains_findings_v1_schema() {
    let temp = setup_repo_with_long_line();

    let output = AssertCommand::cargo_bin("review-engine")
        .expect("binary exists")
        .args(["scan", "--staged", "--repo"])
        .arg(temp.path())
        .args(["--format", "json"])        
        .output()
        .expect("run command");

    assert_eq!(output.status.code(), Some(0));
    let stdout = String::from_utf8(output.stdout).expect("utf8");
    let json: Value = serde_json::from_str(&stdout).expect("json output");
    assert_eq!(json["schema_version"], "findings.v1");
    assert!(json["findings"].is_array());
}
