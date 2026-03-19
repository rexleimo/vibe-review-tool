use std::path::PathBuf;

use clap::{Parser, Subcommand};
use review_engine::config::{BlockThreshold, OutputFormat, ScanConfig};
use review_engine::engine::{compute_exit_code, run_scan};
use review_engine::output::{render_json, render_text};

#[derive(Debug, Parser)]
#[command(name = "review-engine")]
#[command(about = "Review staged git changes with deterministic rules")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    Scan {
        #[arg(long)]
        staged: bool,
        #[arg(long, default_value = ".")]
        repo: PathBuf,
        #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
        format: OutputFormat,
        #[arg(long, value_enum, default_value_t = BlockThreshold::Error)]
        block_on: BlockThreshold,
        #[arg(long, default_value_t = 120)]
        max_line_length: usize,
    },
}

fn main() {
    let cli = Cli::parse();

    let exit_code = match cli.command {
        Commands::Scan {
            staged,
            repo,
            format,
            block_on,
            max_line_length,
        } => {
            let config = ScanConfig {
                repo,
                staged,
                block_on,
                max_line_length,
            };

            match run_scan(&config) {
                Ok(result) => {
                    let rendered = match format {
                        OutputFormat::Text => render_text(&result),
                        OutputFormat::Json => render_json(&result),
                    };
                    println!("{}", rendered);
                    compute_exit_code(result.summary.blocking_count)
                }
                Err(err) => {
                    eprintln!("error: {err}");
                    2
                }
            }
        }
    };

    std::process::exit(exit_code);
}
