use crate::domain::{Finding, Severity};
use crate::git::ChangedLine;

use super::finding_id;

pub fn evaluate_line_too_long(line: &ChangedLine, max_line_length: usize) -> Option<Finding> {
    if line.content.chars().count() <= max_line_length {
        return None;
    }

    let message = format!("Line exceeds {} characters.", max_line_length);

    Some(Finding {
        id: finding_id("line-too-long", &line.file, Some(line.line), &message),
        rule_id: "line-too-long".to_string(),
        severity: Severity::Warning,
        file: line.file.clone(),
        line: Some(line.line),
        title: "Line too long".to_string(),
        message,
        suggestion: Some("Wrap this line or extract parts into smaller expressions.".to_string()),
    })
}
