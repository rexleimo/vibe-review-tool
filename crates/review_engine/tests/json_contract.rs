use review_engine::empty_scan_payload;

#[test]
fn json_payload_contains_required_top_level_fields() {
    let payload = empty_scan_payload("/tmp/repo", "error");
    let v = serde_json::to_value(payload).expect("payload should serialize");

    assert_eq!(v["schema_version"], "findings.v1");
    assert_eq!(v["repo"], "/tmp/repo");
    assert_eq!(v["mode"], "staged");
    assert!(v.get("summary").is_some());
    assert!(v.get("findings").is_some());
}
