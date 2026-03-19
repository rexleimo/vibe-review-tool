use std::path::PathBuf;

use clap::ValueEnum;
use serde::{Deserialize, Serialize};

use crate::domain::Severity;

#[derive(Debug, Clone, Copy, Eq, PartialEq, ValueEnum)]
pub enum OutputFormat {
    Text,
    Json,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum BlockThreshold {
    Error,
    Warning,
    Info,
    None,
}

impl BlockThreshold {
    pub fn as_str(self) -> &'static str {
        match self {
            BlockThreshold::Error => "error",
            BlockThreshold::Warning => "warning",
            BlockThreshold::Info => "info",
            BlockThreshold::None => "none",
        }
    }

    pub fn blocks(self, severity: Severity) -> bool {
        match self {
            BlockThreshold::Error => severity == Severity::Error,
            BlockThreshold::Warning => severity == Severity::Error || severity == Severity::Warning,
            BlockThreshold::Info => true,
            BlockThreshold::None => false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub repo: PathBuf,
    pub staged: bool,
    pub block_on: BlockThreshold,
    pub max_line_length: usize,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            repo: PathBuf::from("."),
            staged: true,
            block_on: BlockThreshold::Error,
            max_line_length: 120,
        }
    }
}
