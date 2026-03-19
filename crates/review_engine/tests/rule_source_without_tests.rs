use review_engine::rules::classification::{is_source_file, is_test_file};
use review_engine::rules::source_without_tests::evaluate_changed_source_without_tests;

#[test]
fn triggers_when_source_changed_but_no_test_files_changed() {
    let changed = vec!["src/service/user.rs".to_string(), "README.md".to_string()];
    let finding = evaluate_changed_source_without_tests(&changed).expect("rule should trigger");

    assert_eq!(finding.rule_id, "changed-source-without-changed-tests");
    assert_eq!(finding.file, ".");
    assert!(finding.line.is_none());
}

#[test]
fn does_not_trigger_when_any_test_file_changed() {
    let changed = vec![
        "src/service/user.rs".to_string(),
        "tests/service/user_test.rs".to_string(),
    ];
    let finding = evaluate_changed_source_without_tests(&changed);

    assert!(finding.is_none());
}

#[test]
fn source_classification_requires_path_and_extension() {
    assert!(is_source_file("src/main.rs"));
    assert!(is_source_file("app/widget.tsx"));
    assert!(!is_source_file("docs/main.rs"));
    assert!(!is_source_file("src/README.md"));
}

#[test]
fn test_classification_matches_expected_patterns() {
    assert!(is_test_file("tests/main_test.rs"));
    assert!(is_test_file("src/foo/bar.test.ts"));
    assert!(is_test_file("src/__tests__/bar.ts"));
    assert!(!is_test_file("src/main.rs"));
}
