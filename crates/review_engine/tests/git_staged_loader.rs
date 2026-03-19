use std::fs;
use std::path::Path;
use std::process::Command;

use review_engine::git::load_staged;
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

#[test]
fn loads_changed_files_and_added_lines_from_staged_diff() {
    let temp = TempDir::new().expect("temp dir");
    let repo = temp.path();

    run_git(repo, &["init"]);
    run_git(repo, &["config", "user.email", "test@example.com"]);
    run_git(repo, &["config", "user.name", "Tester"]);

    let file_path = repo.join("src/sample.rs");
    fs::create_dir_all(file_path.parent().expect("parent")).expect("mkdir");
    fs::write(&file_path, "fn main() {\n    println!(\"hello\");\n}\n").expect("write base");

    run_git(repo, &["add", "."]);
    run_git(repo, &["commit", "-m", "init"]);

    fs::write(
        &file_path,
        "fn main() {\n    println!(\"hello\");\n    let x = 123;\n}\n",
    )
    .expect("write changed");

    run_git(repo, &["add", "src/sample.rs"]);

    let staged = load_staged(repo).expect("load staged diff");

    assert!(staged.changed_files.iter().any(|p| p == "src/sample.rs"));
    assert!(
        staged
            .changed_lines
            .iter()
            .any(|line| line.file == "src/sample.rs" && line.line == 3 && line.content.contains("let x = 123"))
    );
}
