use crate::domain::{Finding, ScanResult};

pub fn render_text(result: &ScanResult) -> String {
    let mut out = String::new();
    out.push_str("Review Engine Findings\n");
    out.push_str(&format!(
        "Total: {} (error: {}, warning: {}, info: {})\n",
        result.summary.total,
        result.summary.by_severity.error,
        result.summary.by_severity.warning,
        result.summary.by_severity.info
    ));
    out.push_str(&format!(
        "Blocking threshold: {} | blocking findings: {}\n",
        result.summary.blocking_threshold, result.summary.blocking_count
    ));

    if result.findings.is_empty() {
        out.push_str("No findings.\n");
        return out;
    }

    out.push('\n');
    for finding in &result.findings {
        out.push_str(&render_text_finding(finding));
        out.push('\n');
    }

    out
}

pub fn render_json(result: &ScanResult) -> String {
    serde_json::to_string_pretty(result).unwrap_or_else(|_| "{}".to_string())
}

fn render_text_finding(finding: &Finding) -> String {
    let location = match finding.line {
        Some(line) => format!("{}:{}", finding.file, line),
        None => finding.file.clone(),
    };

    format!(
        "- [{}] {} {} - {}",
        finding.severity.as_str(),
        finding.rule_id,
        location,
        finding.message
    )
}
