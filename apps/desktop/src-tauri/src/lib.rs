use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{AboutMetadataBuilder, MenuBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager,
};

const DEFAULT_PAGE_SIZE: usize = 200;
const MAX_PAGE_SIZE: usize = 200;
const MAX_RENDER_BYTES: usize = 600_000;
const MAX_RENDER_LINES: usize = 10_000;
const MENU_EVENT_NAME: &str = "menu-action";
const MENU_PROJECT_OPEN: &str = "project.open";
const MENU_PROJECT_OPEN_RECENT: &str = "project.open_recent";
const MENU_PROJECT_SWITCH: &str = "project.switch";
const MENU_PROJECT_REFRESH_CONTEXT: &str = "project.refresh_context";
const MENU_PROJECT_CLOSE: &str = "project.close";
const MENU_REVIEW_COMMIT: &str = "review.commit";
const MENU_REVIEW_WORKSPACE: &str = "review.workspace";
const MENU_REVIEW_REFRESH: &str = "review.refresh";
const MENU_REVIEW_NEXT_FILE: &str = "review.next_file";
const MENU_REVIEW_PREVIOUS_FILE: &str = "review.previous_file";
const MENU_AI_SUMMARY: &str = "ai.summary";
const MENU_AI_EXPLAIN_DIFF: &str = "ai.explain_diff";
const MENU_AI_SURFACE_RISKS: &str = "ai.surface_risks";
const MENU_AI_SUGGEST_FIX: &str = "ai.suggest_fix";
const MENU_AI_DRAFT_COMMENT: &str = "ai.draft_comment";
const MENU_VIEW_TOGGLE_SIDEBAR: &str = "view.toggle_sidebar";
const MENU_VIEW_FOCUS_DIFF: &str = "view.focus_diff";
const MENU_VIEW_RESET_LAYOUT: &str = "view.reset_layout";
const MENU_WINDOW_BRING_ALL_TO_FRONT: &str = "window.bring_all_to_front";
const MENU_HELP_WELCOME: &str = "help.welcome";
const MENU_HELP_SHORTCUTS: &str = "help.shortcuts";
const MENU_APP_SETTINGS: &str = "app.settings";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommitNode {
    sha: String,
    parents: Vec<String>,
    author: String,
    date: String,
    subject: String,
    refs: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommitGraphResponse {
    commits: Vec<CommitNode>,
    has_more: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChangedFile {
    path: String,
    old_path: Option<String>,
    status: String,
    status_raw: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileDiffResponse {
    path: String,
    old_path: Option<String>,
    status: String,
    is_binary: bool,
    too_large: bool,
    too_large_reason: Option<String>,
    old_content: Option<String>,
    new_content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitGraphRequest {
    repo: String,
    limit: Option<usize>,
    offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitFilesRequest {
    repo: String,
    commit_sha: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitFileDiffRequest {
    repo: String,
    commit_sha: String,
    path: String,
    old_path: Option<String>,
    status: String,
    force: Option<bool>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum WorkspaceMode {
    All,
    Staged,
    Unstaged,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFilesRequest {
    repo: String,
    mode: WorkspaceMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFileDiffRequest {
    repo: String,
    mode: WorkspaceMode,
    path: String,
    old_path: Option<String>,
    status: String,
    force: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum AiProvider {
    Codex,
    Claude,
    Gemini,
    Opencode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiProviderStatus {
    provider: AiProvider,
    label: String,
    command: String,
    available: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateSummaryRequest {
    repo: String,
    provider: AiProvider,
    mode: String,
    workspace_mode: Option<WorkspaceMode>,
    selected_commit_sha: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateSummaryResponse {
    provider: AiProvider,
    provider_label: String,
    summary: String,
    truncated: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuggestFixRequest {
    repo: String,
    mode: String,
    commit_sha: Option<String>,
    file_path: String,
    file_old_content: String,
    file_new_content: String,
    prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SuggestFixResponse {
    suggestion: String,
    truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MenuActionPayload {
    action: String,
    value: Option<String>,
}

#[tauri::command]
fn get_ai_provider_statuses() -> Result<Vec<AiProviderStatus>, String> {
    Ok(vec![
        provider_status(AiProvider::Codex),
        provider_status(AiProvider::Claude),
        provider_status(AiProvider::Gemini),
        provider_status(AiProvider::Opencode),
    ])
}

#[tauri::command]
fn generate_review_summary(req: GenerateSummaryRequest) -> Result<GenerateSummaryResponse, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    let (prompt, truncated) = build_summary_prompt(&repo, &req)?;
    let provider = req.provider;
    let summary = run_provider_summary(provider, &repo, &prompt)?;

    if summary.trim().is_empty() {
        return Err(format!("{} returned empty output", provider_label(provider)));
    }

    Ok(GenerateSummaryResponse {
        provider,
        provider_label: provider_label(provider).to_string(),
        summary,
        truncated,
    })
}

#[tauri::command]
fn suggest_fix(req: SuggestFixRequest) -> Result<SuggestFixResponse, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    const MAX_DIFF_CHARS: usize = 15_000;

    let diff_content = format!(
        "--- OLD ---\n{}\n--- NEW ---\n{}",
        req.file_old_content,
        req.file_new_content
    );

    let truncated = diff_content.len() > MAX_DIFF_CHARS;
    let diff_for_prompt = if truncated {
        &diff_content[..MAX_DIFF_CHARS]
    } else {
        &diff_content
    };

    let prompt = format!(
        "You are an expert code reviewer. Based on the following file diff and the user's fix request, provide a detailed fix suggestion.\n\
\n\
         File: {}\n\
\n\
         Diff:\n{}\n\
\n\
         User's fix request:\n{}\n\
\n\
         Respond in plain text. Structure your response with:\n\
         1. Problem Analysis — what is wrong\n\
         2. Suggested Fix — concrete code changes or approach\n\
         3. Alternative Approach — if applicable",
        req.file_path,
        diff_for_prompt,
        req.prompt
    );

    let executable = resolve_provider_command(AiProvider::Codex)
        .ok_or_else(|| "Codex CLI is unavailable. Please install it first.".to_string())?;

    let temp_path = std::env::temp_dir().join(format!(
        "review-editor-fix-{}.txt",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));

    let output = Command::new(executable)
        .arg("exec")
        .arg("-C")
        .arg(&repo)
        .arg("--skip-git-repo-check")
        .arg("-o")
        .arg(&temp_path)
        .arg(&prompt)
        .env("PATH", get_full_path())
        .output()
        .map_err(|e| format!("failed to run Codex CLI: {e}"))?;

    let suggestion = fs::read_to_string(&temp_path).unwrap_or_default();
    let _ = fs::remove_file(&temp_path);

    if output.status.success() && !suggestion.trim().is_empty() {
        Ok(SuggestFixResponse {
            suggestion: suggestion.trim().to_string(),
            truncated,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(if stderr.trim().is_empty() {
            "Codex CLI did not produce a suggestion".to_string()
        } else {
            stderr.trim().to_string()
        })
    }
}

#[tauri::command]
fn get_commit_graph(req: CommitGraphRequest) -> Result<CommitGraphResponse, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    let limit = req.limit.unwrap_or(DEFAULT_PAGE_SIZE).clamp(1, MAX_PAGE_SIZE);
    let offset = req.offset.unwrap_or(0);
    let fetch = limit + 1;

    let args = vec![
        "log".to_string(),
        "--date=iso-strict".to_string(),
        "--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1f%D%x1e".to_string(),
        format!("-n{fetch}"),
        format!("--skip={offset}"),
    ];

    let raw = run_git_text(&repo, &args)?;
    let mut commits = parse_commit_nodes(&raw);
    let has_more = commits.len() > limit;
    if has_more {
        commits.truncate(limit);
    }

    Ok(CommitGraphResponse { commits, has_more })
}

#[tauri::command]
fn get_commit_files(req: CommitFilesRequest) -> Result<Vec<ChangedFile>, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    let args = vec![
        "show".to_string(),
        "--name-status".to_string(),
        "--pretty=format:".to_string(),
        req.commit_sha,
    ];
    let raw = run_git_text(&repo, &args)?;
    Ok(parse_changed_files(&raw))
}

#[tauri::command]
fn get_commit_file_diff(req: CommitFileDiffRequest) -> Result<FileDiffResponse, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    let force = req.force.unwrap_or(false);
    let source_old_path = req.old_path.clone().unwrap_or_else(|| req.path.clone());

    let old_bytes = if req.status == "A" {
        None
    } else {
        git_blob_bytes(&repo, &format!("{}^1:{}", req.commit_sha, source_old_path))?
    };

    let new_bytes = if req.status == "D" {
        None
    } else {
        git_blob_bytes(&repo, &format!("{}:{}", req.commit_sha, req.path))?
    };

    build_diff_response(
        req.path,
        req.old_path,
        req.status,
        old_bytes,
        new_bytes,
        force,
    )
}

#[tauri::command]
fn get_workspace_files(req: WorkspaceFilesRequest) -> Result<Vec<ChangedFile>, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    workspace_files_from_status(&repo, req.mode)
}

#[tauri::command]
fn get_workspace_file_diff(req: WorkspaceFileDiffRequest) -> Result<FileDiffResponse, String> {
    let repo = normalize_repo(&req.repo);
    ensure_git_repo(&repo)?;

    let force = req.force.unwrap_or(false);
    let source_old_path = req.old_path.clone().unwrap_or_else(|| req.path.clone());

    let (old_bytes, new_bytes) = match req.mode {
        WorkspaceMode::All => {
            let old_bytes = if req.status == "A" {
                None
            } else {
                git_blob_bytes(&repo, &format!("HEAD:{}", source_old_path))?
            };
            let new_bytes = if req.status == "D" {
                None
            } else {
                // In all mode, prefer worktree content and fallback to index if missing.
                let wt = read_worktree_bytes(&repo, &req.path)?;
                if wt.is_some() {
                    wt
                } else {
                    git_blob_bytes(&repo, &format!(":{}", req.path))?
                }
            };
            (old_bytes, new_bytes)
        }
        WorkspaceMode::Staged => {
            let old_bytes = if req.status == "A" {
                None
            } else {
                git_blob_bytes(&repo, &format!("HEAD:{}", source_old_path))?
            };
            let new_bytes = if req.status == "D" {
                None
            } else {
                git_blob_bytes(&repo, &format!(":{}", req.path))?
            };
            (old_bytes, new_bytes)
        }
        WorkspaceMode::Unstaged => {
            let old_bytes = if req.status == "A" {
                None
            } else {
                git_blob_bytes(&repo, &format!(":{}", source_old_path))?
            };
            let new_bytes = if req.status == "D" {
                None
            } else {
                read_worktree_bytes(&repo, &req.path)?
            };
            (old_bytes, new_bytes)
        }
    };

    build_diff_response(
        req.path,
        req.old_path,
        req.status,
        old_bytes,
        new_bytes,
        force,
    )
}

fn normalize_repo(repo: &str) -> PathBuf {
    if repo.trim().is_empty() {
        PathBuf::from(".")
    } else {
        PathBuf::from(repo)
    }
}

fn ensure_git_repo(repo: &Path) -> Result<(), String> {
    let args = vec![
        "rev-parse".to_string(),
        "--is-inside-work-tree".to_string(),
    ];
    let out = run_git_text(repo, &args)?;
    if out.trim() == "true" {
        Ok(())
    } else {
        Err(format!("not a git repository: {}", repo.display()))
    }
}

fn run_git_text(repo: &Path, args: &[String]) -> Result<String, String> {
    let output = run_git_bytes(repo, args)?;
    Ok(String::from_utf8_lossy(&output).to_string())
}

fn run_git_bytes(repo: &Path, args: &[String]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|err| format!("failed to run git: {err}"))?;

    if output.status.success() {
        Ok(output.stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        Err(if msg.is_empty() {
            format!("git command failed in {}", repo.display())
        } else {
            msg
        })
    }
}

fn parse_commit_nodes(raw: &str) -> Vec<CommitNode> {
    let mut commits = Vec::new();

    for record in raw.split('\u{001e}') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }

        let fields: Vec<&str> = record.split('\u{001f}').collect();
        if fields.len() < 6 {
            continue;
        }

        commits.push(CommitNode {
            sha: fields[0].to_string(),
            parents: if fields[1].trim().is_empty() {
                Vec::new()
            } else {
                fields[1]
                    .split_whitespace()
                    .map(ToString::to_string)
                    .collect()
            },
            author: fields[2].to_string(),
            date: fields[3].to_string(),
            subject: fields[4].to_string(),
            refs: fields[5].to_string(),
        });
    }

    commits
}

fn parse_changed_files(raw: &str) -> Vec<ChangedFile> {
    let mut files = Vec::new();

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 {
            continue;
        }

        let status_raw = parts[0].to_string();
        let status_char = status_raw.chars().next().unwrap_or('M');
        let status = status_char.to_string();

        if matches!(status_char, 'R' | 'C') {
            if parts.len() < 3 {
                continue;
            }
            files.push(ChangedFile {
                path: parts[2].to_string(),
                old_path: Some(parts[1].to_string()),
                status,
                status_raw,
            });
            continue;
        }

        files.push(ChangedFile {
            path: parts[1].to_string(),
            old_path: None,
            status,
            status_raw,
        });
    }

    files
}

fn workspace_files_from_status(repo: &Path, mode: WorkspaceMode) -> Result<Vec<ChangedFile>, String> {
    let args = vec!["status".to_string(), "--porcelain=v1".to_string()];
    let raw = run_git_text(repo, &args)?;
    let mut files = Vec::new();

    for line in raw.lines() {
        if line.len() < 3 {
            continue;
        }

        let x = line.as_bytes()[0] as char;
        let y = line.as_bytes()[1] as char;
        let rest = line[3..].trim();
        if rest.is_empty() {
            continue;
        }

        let include = match mode {
            WorkspaceMode::All => x != ' ' || y != ' ',
            WorkspaceMode::Staged => x != ' ' && x != '?',
            WorkspaceMode::Unstaged => y != ' ' || x == '?',
        };
        if !include {
            continue;
        }

        let (old_path, path) = if x == 'R' || y == 'R' || x == 'C' || y == 'C' {
            let mut split = rest.splitn(2, " -> ");
            let left = split.next().unwrap_or_default().trim();
            let right = split.next().unwrap_or_default().trim();
            if left.is_empty() || right.is_empty() {
                (None, rest.to_string())
            } else {
                (Some(left.to_string()), right.to_string())
            }
        } else {
            (None, rest.to_string())
        };

        let status = map_workspace_status(x, y).to_string();
        files.push(ChangedFile {
            path,
            old_path,
            status,
            status_raw: format!("{x}{y}"),
        });
    }

    Ok(files)
}

fn map_workspace_status(x: char, y: char) -> char {
    if x == '?' {
        return 'A';
    }
    if matches!(x, 'R' | 'C' | 'D' | 'A' | 'U') {
        return x;
    }
    if matches!(y, 'R' | 'C' | 'D' | 'U') {
        return y;
    }
    if y == 'M' || x == 'M' || y == 'T' || x == 'T' {
        return 'M';
    }
    'M'
}

fn git_blob_bytes(repo: &Path, spec: &str) -> Result<Option<Vec<u8>>, String> {
    let exists = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["cat-file", "-e", spec])
        .status()
        .map_err(|err| format!("failed to run git cat-file: {err}"))?
        .success();

    if !exists {
        return Ok(None);
    }

    let args = vec!["show".to_string(), spec.to_string()];
    let bytes = run_git_bytes(repo, &args)?;
    Ok(Some(bytes))
}

fn read_worktree_bytes(repo: &Path, rel_path: &str) -> Result<Option<Vec<u8>>, String> {
    let full_path = repo.join(rel_path);
    if !full_path.exists() {
        return Ok(None);
    }

    fs::read(&full_path)
        .map(Some)
        .map_err(|err| format!("failed to read worktree file {}: {err}", full_path.display()))
}

fn build_diff_response(
    path: String,
    old_path: Option<String>,
    status: String,
    old_bytes: Option<Vec<u8>>,
    new_bytes: Option<Vec<u8>>,
    force: bool,
) -> Result<FileDiffResponse, String> {
    if bytes_are_binary(old_bytes.as_deref()) || bytes_are_binary(new_bytes.as_deref()) {
        return Ok(FileDiffResponse {
            path,
            old_path,
            status,
            is_binary: true,
            too_large: false,
            too_large_reason: None,
            old_content: None,
            new_content: None,
        });
    }

    let old_content = decode_utf8_lossless(old_bytes)?;
    let new_content = decode_utf8_lossless(new_bytes)?;

    let total_bytes = old_content
        .as_ref()
        .map(|s| s.len())
        .unwrap_or(0)
        .saturating_add(new_content.as_ref().map(|s| s.len()).unwrap_or(0));
    let total_lines = old_content
        .as_ref()
        .map(|s| s.lines().count())
        .unwrap_or(0)
        .saturating_add(new_content.as_ref().map(|s| s.lines().count()).unwrap_or(0));

    if !force && (total_bytes > MAX_RENDER_BYTES || total_lines > MAX_RENDER_LINES) {
        return Ok(FileDiffResponse {
            path,
            old_path,
            status,
            is_binary: false,
            too_large: true,
            too_large_reason: Some(format!(
                "Diff too large to render automatically ({} bytes, {} lines). Click force open.",
                total_bytes, total_lines
            )),
            old_content: None,
            new_content: None,
        });
    }

    Ok(FileDiffResponse {
        path,
        old_path,
        status,
        is_binary: false,
        too_large: false,
        too_large_reason: None,
        old_content,
        new_content,
    })
}

fn bytes_are_binary(bytes: Option<&[u8]>) -> bool {
    bytes
        .map(|b| b.iter().take(8000).any(|v| *v == 0))
        .unwrap_or(false)
}

fn decode_utf8_lossless(bytes: Option<Vec<u8>>) -> Result<Option<String>, String> {
    match bytes {
        None => Ok(None),
        Some(raw) => String::from_utf8(raw)
            .map(Some)
            .map_err(|_| "file contains non-utf8 content and cannot be rendered as text".to_string()),
    }
}

fn emit_menu_action<R: tauri::Runtime>(app: &tauri::AppHandle<R>, action: &str, value: Option<String>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(
            MENU_EVENT_NAME,
            MenuActionPayload {
                action: action.to_string(),
                value,
            },
        );
    }
}

fn provider_status(provider: AiProvider) -> AiProviderStatus {
    let resolved = resolve_provider_command(provider);
    let command = resolved
        .as_ref()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| provider_command(provider).to_string());
    let available = resolved.is_some();

    AiProviderStatus {
        provider,
        label: provider_label(provider).to_string(),
        command,
        available,
    }
}

fn provider_command(provider: AiProvider) -> &'static str {
    match provider {
        AiProvider::Codex => "codex",
        AiProvider::Claude => "claude",
        AiProvider::Gemini => "gemini",
        AiProvider::Opencode => "opencode",
    }
}

fn provider_label(provider: AiProvider) -> &'static str {
    match provider {
        AiProvider::Codex => "Codex CLI",
        AiProvider::Claude => "Claude Code",
        AiProvider::Gemini => "Gemini CLI",
        AiProvider::Opencode => "OpenCode",
    }
}

fn resolve_provider_command(provider: AiProvider) -> Option<PathBuf> {
    for candidate in provider_command_candidates(provider) {
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    std::env::var_os("PATH").and_then(|path| {
        std::env::split_paths(&path)
            .map(|dir| dir.join(provider_command(provider)))
            .find(|candidate| candidate.is_file())
    })
}

/// Returns a comprehensive PATH that includes common tool locations.
/// This is needed because GUI apps on macOS don't inherit the user's full PATH.
fn get_full_path() -> String {
    let home = std::env::var_os("HOME").unwrap_or_default();
    let home = PathBuf::from(home);

    // Start with current PATH if available
    let mut paths: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| env::split_paths(&p).collect())
        .unwrap_or_default();

    // Add common tool locations that may not be in GUI app's PATH
    let additional_paths = [
        home.join(".bun/bin"),
        home.join(".local/bin"),
        home.join(".local/state/fnm_multishells").join("*").join("bin"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ];

    for p in &additional_paths {
        if !paths.contains(p) {
            // Handle wildcard paths (fnm multishells)
            if p.to_string_lossy().contains('*') {
                if let Ok(entries) = fs::read_dir(p.parent().unwrap_or(p)) {
                    for entry in entries.flatten() {
                        let bin_path = entry.path().join("bin");
                        if bin_path.is_dir() && !paths.contains(&bin_path) {
                            paths.push(bin_path);
                        }
                    }
                }
            } else if p.is_dir() && !paths.contains(p) {
                paths.push(p.clone());
            }
        }
    }

    env::join_paths(paths)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| String::from("/usr/bin:/bin:/usr/sbin:/sbin"))
}

fn provider_command_candidates(provider: AiProvider) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        candidates.push(home.join(".bun/bin").join(provider_command(provider)));
        candidates.push(home.join(".local/bin").join(provider_command(provider)));

        if matches!(provider, AiProvider::Gemini) {
            let fnm_root = home.join(".local/state/fnm_multishells");
            if let Ok(entries) = fs::read_dir(fnm_root) {
                for entry in entries.flatten() {
                    candidates.push(entry.path().join("bin").join("gemini"));
                }
            }
        }
    }

    candidates.push(PathBuf::from("/opt/homebrew/bin").join(provider_command(provider)));
    candidates.push(PathBuf::from("/usr/local/bin").join(provider_command(provider)));

    candidates
}

fn build_summary_prompt(
    repo: &Path,
    req: &GenerateSummaryRequest,
) -> Result<(String, bool), String> {
    const MAX_FILES: usize = 4;
    const MAX_DIFF_CHARS: usize = 20_000;

    let mut prompt = String::from(
        "You are generating a concise code review summary for a desktop review tool.\n\
         Return plain text only.\n\
         Structure your response with these sections:\n\
         Summary\n\
         Key Changes\n\
         Risks\n\
         Suggested Next Checks\n\n",
    );

    let mut used_chars = 0usize;
    let mut truncated = false;

    if req.mode == "commit" {
        let sha = req
            .selected_commit_sha
            .as_deref()
            .ok_or_else(|| "missing selected commit for commit summary".to_string())?;
        let subject = run_git_text(
            repo,
            &[
                "show".to_string(),
                "-s".to_string(),
                "--format=%s".to_string(),
                sha.to_string(),
            ],
        )?;
        let files = get_commit_files(CommitFilesRequest {
            repo: repo.display().to_string(),
            commit_sha: sha.to_string(),
        })?;

        prompt.push_str(&format!(
            "Mode: commit review\nRepository: {}\nCommit: {}\nTitle: {}\n\nChanged files:\n",
            repo.display(),
            sha,
            subject.trim()
        ));
        prompt.push_str(&render_file_list(&files));
        prompt.push_str("\nIncluded diffs:\n");

        for file in files.iter().take(MAX_FILES) {
            let diff = get_commit_file_diff(CommitFileDiffRequest {
                repo: repo.display().to_string(),
                commit_sha: sha.to_string(),
                path: file.path.clone(),
                old_path: file.old_path.clone(),
                status: file.status.clone(),
                force: Some(false),
            })?;
            let block = render_diff_block(&diff);
            used_chars += block.len();
            if used_chars > MAX_DIFF_CHARS {
                truncated = true;
                break;
            }
            prompt.push_str(&block);
        }

        if files.len() > MAX_FILES {
            truncated = true;
        }
    } else {
        let workspace_mode = req.workspace_mode.unwrap_or(WorkspaceMode::All);
        let files = get_workspace_files(WorkspaceFilesRequest {
            repo: repo.display().to_string(),
            mode: workspace_mode,
        })?;
        prompt.push_str(&format!(
            "Mode: workspace review\nRepository: {}\nWorkspace scope: {:?}\n\nChanged files:\n",
            repo.display(),
            workspace_mode
        ));
        prompt.push_str(&render_file_list(&files));
        prompt.push_str("\nIncluded diffs:\n");

        for file in files.iter().take(MAX_FILES) {
            let diff = get_workspace_file_diff(WorkspaceFileDiffRequest {
                repo: repo.display().to_string(),
                mode: workspace_mode,
                path: file.path.clone(),
                old_path: file.old_path.clone(),
                status: file.status.clone(),
                force: Some(false),
            })?;
            let block = render_diff_block(&diff);
            used_chars += block.len();
            if used_chars > MAX_DIFF_CHARS {
                truncated = true;
                break;
            }
            prompt.push_str(&block);
        }

        if files.len() > MAX_FILES {
            truncated = true;
        }
    }

    if truncated {
        prompt.push_str("\nNote: Context was truncated to fit file and diff limits.\n");
    }

    Ok((prompt, truncated))
}

fn render_file_list(files: &[ChangedFile]) -> String {
    if files.is_empty() {
        return "- No changed files detected.\n".to_string();
    }

    files.iter()
        .map(|file| format!("- [{}] {}\n", file.status, file.path))
        .collect::<Vec<_>>()
        .join("")
}

fn render_diff_block(diff: &FileDiffResponse) -> String {
    if diff.is_binary {
        return format!("\n### {}\nBinary file. No text diff available.\n", diff.path);
    }
    if diff.too_large {
        return format!(
            "\n### {}\nDiff too large to include automatically: {}\n",
            diff.path,
            diff.too_large_reason.clone().unwrap_or_default()
        );
    }

    format!(
        "\n### {}\n--- OLD ---\n{}\n--- NEW ---\n{}\n",
        diff.path,
        diff.old_content.clone().unwrap_or_default(),
        diff.new_content.clone().unwrap_or_default()
    )
}

fn run_provider_summary(provider: AiProvider, repo: &Path, prompt: &str) -> Result<String, String> {
    match provider {
        AiProvider::Codex => run_codex_summary(repo, prompt),
        AiProvider::Claude => run_claude_summary(repo, prompt),
        AiProvider::Gemini => run_gemini_summary(repo, prompt),
        AiProvider::Opencode => run_opencode_summary(repo, prompt),
    }
}

fn run_codex_summary(repo: &Path, prompt: &str) -> Result<String, String> {
    let executable = resolve_provider_command(AiProvider::Codex)
        .ok_or_else(|| "Codex CLI is unavailable in this app environment".to_string())?;
    let temp_path = std::env::temp_dir().join(format!(
        "review-editor-codex-summary-{}.txt",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    ));

    let output = Command::new(executable)
        .arg("exec")
        .arg("-C")
        .arg(repo)
        .arg("--skip-git-repo-check")
        .arg("-o")
        .arg(&temp_path)
        .arg(prompt)
        .env("PATH", get_full_path())
        .output()
        .map_err(|err| format!("failed to run Codex CLI: {err}"))?;

    let summary = fs::read_to_string(&temp_path).unwrap_or_default();
    let _ = fs::remove_file(&temp_path);

    if output.status.success() && !summary.trim().is_empty() {
        Ok(summary)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(if stderr.trim().is_empty() {
            "Codex CLI did not produce a summary".to_string()
        } else {
            stderr.trim().to_string()
        })
    }
}

fn run_claude_summary(repo: &Path, prompt: &str) -> Result<String, String> {
    let executable = resolve_provider_command(AiProvider::Claude)
        .ok_or_else(|| "Claude Code is unavailable in this app environment".to_string())?;
    let output = Command::new(executable)
        .arg("-p")
        .arg("--permission-mode")
        .arg("plan")
        .arg("--output-format")
        .arg("text")
        .arg(prompt)
        .current_dir(repo)
        .env("PATH", get_full_path())
        .output()
        .map_err(|err| format!("failed to run Claude Code: {err}"))?;
    process_command_output(output, "Claude Code")
}

fn run_gemini_summary(repo: &Path, prompt: &str) -> Result<String, String> {
    let executable = resolve_provider_command(AiProvider::Gemini)
        .ok_or_else(|| "Gemini CLI is unavailable in this app environment".to_string())?;
    let output = Command::new(executable)
        .arg("-p")
        .arg(prompt)
        .arg("-o")
        .arg("text")
        .arg("--approval-mode")
        .arg("plan")
        .current_dir(repo)
        .env("PATH", get_full_path())
        .output()
        .map_err(|err| format!("failed to run Gemini CLI: {err}"))?;
    process_command_output(output, "Gemini CLI")
}

fn run_opencode_summary(repo: &Path, prompt: &str) -> Result<String, String> {
    let executable = resolve_provider_command(AiProvider::Opencode)
        .ok_or_else(|| "OpenCode is unavailable in this app environment".to_string())?;
    let output = Command::new(executable)
        .arg("run")
        .arg("--dir")
        .arg(repo)
        .arg(prompt)
        .env("PATH", get_full_path())
        .output()
        .map_err(|err| format!("failed to run OpenCode: {err}"))?;
    process_command_output(output, "OpenCode")
}

fn process_command_output(output: std::process::Output, label: &str) -> Result<String, String> {
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Err(format!("{label} returned empty output"))
        } else {
            Ok(strip_ansi_codes(&stdout))
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!("{label} exited with failure"))
        } else {
            Err(strip_ansi_codes(&stderr))
        }
    }
}

fn strip_ansi_codes(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                let _ = chars.next();
                while let Some(code) = chars.next() {
                    if matches!(code, 'A'..='Z' | 'a'..='z') {
                        break;
                    }
                }
                continue;
            }
        }
        output.push(ch);
    }
    output
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let about = PredefinedMenuItem::about(
        app,
        Some("About Review Editor"),
        Some(
            AboutMetadataBuilder::new()
                .name(Some("Review Editor"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .website(Some("https://chatgpt.com"))
                .website_label(Some("Review Editor"))
                .build(),
        ),
    )?;
    let separator_1 = PredefinedMenuItem::separator(app)?;
    let separator_2 = PredefinedMenuItem::separator(app)?;
    let separator_3 = PredefinedMenuItem::separator(app)?;
    let separator_4 = PredefinedMenuItem::separator(app)?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let zoom = PredefinedMenuItem::maximize(app, Some("Zoom"))?;
    let full_screen = PredefinedMenuItem::fullscreen(app, Some("Enter Full Screen"))?;

    let app_menu = SubmenuBuilder::new(app, "Review Editor")
        .item(&about)
        .text(MENU_APP_SETTINGS, "Settings...")
        .item(&separator_1)
        .item(&hide)
        .item(&hide_others)
        .item(&show_all)
        .item(&separator_2)
        .item(&quit)
        .build()?;

    let project_menu = SubmenuBuilder::new(app, "Project")
        .text(MENU_PROJECT_OPEN, "Open Project...")
        .text(MENU_PROJECT_OPEN_RECENT, "Open Recent")
        .text(MENU_PROJECT_SWITCH, "Switch Project...")
        .item(&PredefinedMenuItem::separator(app)?)
        .text(MENU_PROJECT_REFRESH_CONTEXT, "Refresh Project Context")
        .text(MENU_PROJECT_CLOSE, "Close Project")
        .build()?;

    let review_menu = SubmenuBuilder::new(app, "Review")
        .text(MENU_REVIEW_COMMIT, "Review Current Commit")
        .text(MENU_REVIEW_WORKSPACE, "Review Workspace Changes")
        .text(MENU_REVIEW_REFRESH, "Refresh Review")
        .item(&PredefinedMenuItem::separator(app)?)
        .text(MENU_REVIEW_NEXT_FILE, "Next File")
        .text(MENU_REVIEW_PREVIOUS_FILE, "Previous File")
        .build()?;

    let ai_menu = SubmenuBuilder::new(app, "AI")
        .text(MENU_AI_SUMMARY, "Generate Review Summary")
        .text(MENU_AI_EXPLAIN_DIFF, "Explain Selected Diff")
        .text(MENU_AI_SURFACE_RISKS, "Surface Risks")
        .text(MENU_AI_SUGGEST_FIX, "Suggest Fix")
        .text(MENU_AI_DRAFT_COMMENT, "Draft Review Comment")
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text(MENU_VIEW_TOGGLE_SIDEBAR, "Toggle Sidebar")
        .text(MENU_VIEW_FOCUS_DIFF, "Focus Diff")
        .text(MENU_VIEW_RESET_LAYOUT, "Reset Layout")
        .item(&separator_3)
        .item(&full_screen)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&minimize)
        .item(&zoom)
        .item(&separator_4)
        .text(MENU_WINDOW_BRING_ALL_TO_FRONT, "Bring All to Front")
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .text(MENU_HELP_WELCOME, "Welcome")
        .text(MENU_HELP_SHORTCUTS, "Keyboard Shortcuts")
        .text("help.about", "About Review Editor")
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &project_menu,
            &review_menu,
            &ai_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let menu = build_app_menu(&app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().0.as_str() {
            MENU_PROJECT_OPEN
            | MENU_PROJECT_OPEN_RECENT
            | MENU_PROJECT_SWITCH
            | MENU_PROJECT_REFRESH_CONTEXT
            | MENU_PROJECT_CLOSE
            | MENU_REVIEW_COMMIT
            | MENU_REVIEW_WORKSPACE
            | MENU_REVIEW_REFRESH
            | MENU_REVIEW_NEXT_FILE
            | MENU_REVIEW_PREVIOUS_FILE
            | MENU_AI_SUMMARY
            | MENU_AI_EXPLAIN_DIFF
            | MENU_AI_SURFACE_RISKS
            | MENU_AI_SUGGEST_FIX
            | MENU_AI_DRAFT_COMMENT
            | MENU_VIEW_TOGGLE_SIDEBAR
            | MENU_VIEW_FOCUS_DIFF
            | MENU_VIEW_RESET_LAYOUT
            | MENU_WINDOW_BRING_ALL_TO_FRONT
            | MENU_HELP_WELCOME
            | MENU_HELP_SHORTCUTS
            | MENU_APP_SETTINGS
            | "help.about" => emit_menu_action(app, event.id().0.as_str(), None),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_ai_provider_statuses,
            generate_review_summary,
            suggest_fix,
            get_commit_graph,
            get_commit_files,
            get_commit_file_diff,
            get_workspace_files,
            get_workspace_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_file_list_includes_status_and_path() {
        let files = vec![
            ChangedFile {
                path: "src/app.tsx".to_string(),
                old_path: None,
                status: "M".to_string(),
                status_raw: "M".to_string(),
            },
            ChangedFile {
                path: "src/new.ts".to_string(),
                old_path: None,
                status: "A".to_string(),
                status_raw: "A".to_string(),
            },
        ];

        let rendered = render_file_list(&files);

        assert!(rendered.contains("- [M] src/app.tsx"));
        assert!(rendered.contains("- [A] src/new.ts"));
    }

    #[test]
    fn strip_ansi_codes_removes_escape_sequences() {
        let cleaned = strip_ansi_codes("\u{1b}[31merror\u{1b}[0m output");

        assert_eq!(cleaned, "error output");
    }

    #[test]
    fn provider_label_matches_expected_menu_copy() {
        assert_eq!(provider_label(AiProvider::Codex), "Codex CLI");
        assert_eq!(provider_label(AiProvider::Claude), "Claude Code");
        assert_eq!(provider_label(AiProvider::Gemini), "Gemini CLI");
        assert_eq!(provider_label(AiProvider::Opencode), "OpenCode");
    }

    #[test]
    fn provider_command_candidates_include_common_user_bin_locations() {
        let candidates = provider_command_candidates(AiProvider::Codex);
        let rendered = candidates
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();

        assert!(rendered.iter().any(|path| path.ends_with("/.bun/bin/codex")));
        assert!(rendered.iter().any(|path| path.ends_with("/.local/bin/codex")));
        assert!(rendered.iter().any(|path| path.ends_with("/opt/homebrew/bin/codex")));
    }
}
