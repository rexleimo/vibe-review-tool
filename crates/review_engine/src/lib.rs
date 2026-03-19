pub mod config;
pub mod domain;
pub mod engine;
pub mod git;
pub mod output;
pub mod rules;

pub use domain::{Finding, ScanResult, Severity, SeverityCount, Summary};
pub use git::{ChangedLine, StagedDiff};

pub fn empty_scan_payload(repo: &str, block_on: &str) -> ScanResult {
    ScanResult::empty(repo, block_on)
}
