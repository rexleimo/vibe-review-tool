use review_engine::config::BlockThreshold;
use review_engine::domain::{Finding, Severity};
use review_engine::engine::{compute_exit_code, summarize_findings};

fn mk_finding(severity: Severity) -> Finding {
    Finding {
        id: "id".to_string(),
        rule_id: "rule".to_string(),
        severity,
        file: "src/main.rs".to_string(),
        line: Some(1),
        title: "title".to_string(),
        message: "message".to_string(),
        suggestion: None,
    }
}

#[test]
fn returns_exit_1_when_blocking_findings_exist() {
    let findings = vec![mk_finding(Severity::Error)];
    let (summary, _) = summarize_findings(&findings, BlockThreshold::Error);
    let exit = compute_exit_code(summary.blocking_count);
    assert_eq!(exit, 1);
}

#[test]
fn returns_exit_0_when_findings_below_threshold() {
    let findings = vec![mk_finding(Severity::Warning)];
    let (summary, _) = summarize_findings(&findings, BlockThreshold::Error);
    let exit = compute_exit_code(summary.blocking_count);
    assert_eq!(exit, 0);
}
