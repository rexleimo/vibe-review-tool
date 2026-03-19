use crate::domain::{Finding, Severity};
use crate::git::ChangedLine;

use super::finding_id;

pub fn evaluate_trailing_whitespace(line: &ChangedLine) -> Option<Finding> {
    if !line.content.ends_with(' ') && !line.content.ends_with('\t') {
        return None;
    }

    let message = "Line has trailing whitespace.".to_string();

    Some(Finding {
        id: finding_id("trailing-whitespace", &line.file, Some(line.line), &message),
        rule_id: "trailing-whitespace".to_string(),
        severity: Severity::Warning,
        file: line.file.clone(),
        line: Some(line.line),
        title: "Trailing whitespace".to_string(),
        message,
        suggestion: Some("Remove trailing spaces or tabs at line end.".to_string()),
    })
}
