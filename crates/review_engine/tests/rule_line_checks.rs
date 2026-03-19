use review_engine::ChangedLine;
use review_engine::rules::line_too_long::evaluate_line_too_long;
use review_engine::rules::trailing_whitespace::evaluate_trailing_whitespace;

#[test]
fn line_too_long_flags_added_lines_over_threshold() {
    let line = ChangedLine {
        file: "src/main.rs".to_string(),
        line: 10,
        content: "a".repeat(121),
    };

    let finding = evaluate_line_too_long(&line, 120).expect("should flag long line");
    assert_eq!(finding.rule_id, "line-too-long");
    assert_eq!(finding.line, Some(10));
}

#[test]
fn trailing_whitespace_flags_added_lines_with_suffix_spaces_or_tabs() {
    let line = ChangedLine {
        file: "src/main.rs".to_string(),
        line: 20,
        content: "let x = 1;   ".to_string(),
    };

    let finding = evaluate_trailing_whitespace(&line).expect("should flag trailing whitespace");
    assert_eq!(finding.rule_id, "trailing-whitespace");
    assert_eq!(finding.line, Some(20));
}
