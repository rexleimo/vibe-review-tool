use assert_cmd::Command;
use predicates::str::contains;

#[test]
fn cli_help_shows_scan_subcommand() {
    let mut cmd = Command::cargo_bin("review-engine").expect("binary should exist");
    cmd.arg("--help");
    cmd.assert().success().stdout(contains("scan"));
}
