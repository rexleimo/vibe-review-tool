const SOURCE_DIRS: [&str; 3] = ["src/", "app/", "lib/"];
const SOURCE_EXTS: [&str; 15] = [
    ".rs", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".kt", ".swift", ".c",
    ".cc", ".cpp", ".h", ".hpp",
];

pub fn is_source_file(path: &str) -> bool {
    let path_lower = path.to_ascii_lowercase();
    let in_source_dir = SOURCE_DIRS.iter().any(|prefix| path_lower.starts_with(prefix));
    let has_source_ext = SOURCE_EXTS.iter().any(|ext| path_lower.ends_with(ext));
    in_source_dir && has_source_ext
}

pub fn is_test_file(path: &str) -> bool {
    let path_lower = path.to_ascii_lowercase();
    if path_lower.starts_with("tests/") || path_lower.contains("/__tests__/") || path_lower.starts_with("__tests__/") {
        return true;
    }

    let filename = path_lower.rsplit('/').next().unwrap_or(path_lower.as_str());
    filename.contains(".test.") || filename.contains("_test.")
}
