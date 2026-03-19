use crate::domain::{Finding, Severity};

use super::classification::{is_source_file, is_test_file};
use super::finding_id;

pub fn evaluate_changed_source_without_tests(changed_files: &[String]) -> Option<Finding> {
    let has_source_change = changed_files.iter().any(|path| is_source_file(path));
    let has_test_change = changed_files.iter().any(|path| is_test_file(path));

    if !has_source_change || has_test_change {
        return None;
    }

    let message = "Source files changed without any test file updates in this staged diff.".to_string();

    Some(Finding {
        id: finding_id(
            "changed-source-without-changed-tests",
            ".",
            None,
            &message,
        ),
        rule_id: "changed-source-without-changed-tests".to_string(),
        severity: Severity::Warning,
        file: ".".to_string(),
        line: None,
        title: "Source changed without tests".to_string(),
        message,
        suggestion: Some("Add or update at least one related test before commit.".to_string()),
    })
}
