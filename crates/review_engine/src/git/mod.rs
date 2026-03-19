use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

use anyhow::{anyhow, bail, Context, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedLine {
    pub file: String,
    pub line: usize,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StagedDiff {
    pub changed_files: Vec<String>,
    pub changed_lines: Vec<ChangedLine>,
}

pub fn load_staged(repo: &Path) -> Result<StagedDiff> {
    let repo_arg = repo
        .to_str()
        .ok_or_else(|| anyhow!("repository path is not valid UTF-8"))?;

    let inside = Command::new("git")
        .arg("-C")
        .arg(repo_arg)
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .output()
        .context("failed to run git rev-parse")?;

    if !inside.status.success() {
        bail!("not a git repository: {}", repo.display());
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(repo_arg)
        .arg("diff")
        .arg("--cached")
        .arg("--unified=0")
        .arg("--no-color")
        .arg("--no-ext-diff")
        .output()
        .context("failed to run git diff --cached")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("git diff --cached failed: {}", stderr.trim());
    }

    parse_staged_diff(&String::from_utf8_lossy(&output.stdout))
}

fn parse_staged_diff(text: &str) -> Result<StagedDiff> {
    let mut changed_files = Vec::new();
    let mut seen_files = HashSet::new();
    let mut changed_lines = Vec::new();

    let mut current_file: Option<String> = None;
    let mut current_new_line = 0usize;
    let mut in_hunk = false;

    for raw_line in text.lines() {
        if let Some(rest) = raw_line.strip_prefix("diff --git ") {
            in_hunk = false;
            if let Some(path) = parse_diff_header_file(rest) {
                if seen_files.insert(path.clone()) {
                    changed_files.push(path.clone());
                }
                current_file = Some(path);
            }
            continue;
        }

        if let Some(hunk) = raw_line.strip_prefix("@@") {
            let (new_start, _new_len) = parse_hunk(hunk)?;
            current_new_line = new_start;
            in_hunk = true;
            continue;
        }

        if !in_hunk {
            continue;
        }

        if raw_line.starts_with("+++ ") || raw_line.starts_with("--- ") {
            continue;
        }

        if raw_line.starts_with("+") {
            if let Some(file) = &current_file {
                changed_lines.push(ChangedLine {
                    file: file.clone(),
                    line: current_new_line,
                    content: raw_line[1..].to_string(),
                });
            }
            current_new_line += 1;
            continue;
        }

        if raw_line.starts_with("-") {
            continue;
        }

        if raw_line.starts_with("\\ No newline at end of file") {
            continue;
        }

        current_new_line += 1;
    }

    Ok(StagedDiff {
        changed_files,
        changed_lines,
    })
}

fn parse_diff_header_file(header_rest: &str) -> Option<String> {
    let token = header_rest.split_whitespace().nth(1)?;
    token
        .strip_prefix("b/")
        .map(|s| s.trim_matches('"').to_string())
}

fn parse_hunk(hunk_suffix: &str) -> Result<(usize, usize)> {
    let plus_idx = hunk_suffix
        .find('+')
        .ok_or_else(|| anyhow!("invalid hunk header: missing '+' marker"))?;

    let after_plus = &hunk_suffix[plus_idx + 1..];
    let range = after_plus
        .split_whitespace()
        .next()
        .ok_or_else(|| anyhow!("invalid hunk header: missing new range"))?;

    let mut parts = range.split(',');
    let start = parts
        .next()
        .ok_or_else(|| anyhow!("invalid hunk header: missing start"))?
        .parse::<usize>()
        .context("invalid hunk start")?;
    let len = parts
        .next()
        .map(|v| v.parse::<usize>().context("invalid hunk length"))
        .transpose()?
        .unwrap_or(1);

    Ok((start, len))
}

#[cfg(test)]
mod tests {
    use super::parse_hunk;

    #[test]
    fn parse_hunk_with_explicit_length() {
        let parsed = parse_hunk(" -1,0 +5,2 @@").expect("parse hunk");
        assert_eq!(parsed, (5, 2));
    }

    #[test]
    fn parse_hunk_with_implicit_length() {
        let parsed = parse_hunk(" -1 +5 @@").expect("parse hunk");
        assert_eq!(parsed, (5, 1));
    }
}
