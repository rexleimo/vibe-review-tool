use anyhow::{bail, Result};

use crate::config::{BlockThreshold, ScanConfig};
use crate::domain::{Finding, ScanResult, SeverityCount, Summary};
use crate::git::load_staged;
use crate::rules::line_too_long::evaluate_line_too_long;
use crate::rules::source_without_tests::evaluate_changed_source_without_tests;
use crate::rules::trailing_whitespace::evaluate_trailing_whitespace;

pub fn run_scan(config: &ScanConfig) -> Result<ScanResult> {
    if !config.staged {
        bail!("only --staged mode is supported in P0");
    }

    let repo = std::fs::canonicalize(&config.repo)?;
    let staged = load_staged(&repo)?;

    let mut findings: Vec<Finding> = Vec::new();

    for line in &staged.changed_lines {
        if let Some(finding) = evaluate_line_too_long(line, config.max_line_length) {
            findings.push(finding);
        }
        if let Some(finding) = evaluate_trailing_whitespace(line) {
            findings.push(finding);
        }
    }

    if let Some(finding) = evaluate_changed_source_without_tests(&staged.changed_files) {
        findings.push(finding);
    }

    let (summary, normalized_findings) = summarize_findings(&findings, config.block_on);
    let repo_str = repo.to_string_lossy().into_owned();

    Ok(ScanResult {
        summary,
        findings: normalized_findings,
        ..ScanResult::empty(&repo_str, config.block_on.as_str())
    })
}

pub fn summarize_findings(
    findings: &[Finding],
    block_on: BlockThreshold,
) -> (Summary, Vec<Finding>) {
    let mut count = SeverityCount {
        error: 0,
        warning: 0,
        info: 0,
    };

    let mut blocking_count = 0usize;
    for finding in findings {
        match finding.severity {
            crate::domain::Severity::Error => count.error += 1,
            crate::domain::Severity::Warning => count.warning += 1,
            crate::domain::Severity::Info => count.info += 1,
        }

        if block_on.blocks(finding.severity) {
            blocking_count += 1;
        }
    }

    (
        Summary {
            total: findings.len(),
            by_severity: count,
            blocking_threshold: block_on.as_str().to_string(),
            blocking_count,
        },
        findings.to_vec(),
    )
}

pub fn compute_exit_code(blocking_count: usize) -> i32 {
    if blocking_count > 0 {
        1
    } else {
        0
    }
}
