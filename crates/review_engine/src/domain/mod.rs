use serde::{Deserialize, Serialize};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Error => "error",
            Severity::Warning => "warning",
            Severity::Info => "info",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub rule_id: String,
    pub severity: Severity,
    pub file: String,
    pub line: Option<usize>,
    pub title: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeverityCount {
    pub error: usize,
    pub warning: usize,
    pub info: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Summary {
    pub total: usize,
    pub by_severity: SeverityCount,
    pub blocking_threshold: String,
    pub blocking_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub schema_version: &'static str,
    pub repo: String,
    pub mode: &'static str,
    pub scanned_at: String,
    pub summary: Summary,
    pub findings: Vec<Finding>,
}

impl ScanResult {
    pub fn empty(repo: &str, block_on: &str) -> Self {
        Self {
            schema_version: "findings.v1",
            repo: repo.to_string(),
            mode: "staged",
            scanned_at: now_rfc3339(),
            summary: Summary {
                total: 0,
                by_severity: SeverityCount {
                    error: 0,
                    warning: 0,
                    info: 0,
                },
                blocking_threshold: block_on.to_string(),
                blocking_count: 0,
            },
            findings: Vec::new(),
        }
    }
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}
