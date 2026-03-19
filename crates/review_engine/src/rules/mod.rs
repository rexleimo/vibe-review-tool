use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub mod classification;
pub mod line_too_long;
pub mod source_without_tests;
pub mod trailing_whitespace;

pub(crate) fn finding_id(rule_id: &str, file: &str, line: Option<usize>, message: &str) -> String {
    let mut hasher = DefaultHasher::new();
    rule_id.hash(&mut hasher);
    file.hash(&mut hasher);
    line.hash(&mut hasher);
    message.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}
