//! Log files (task 8.18): JSON lines in the app log folder, one file a day, the last week kept.
//!
//! Only command names, durations, error codes and driver kinds are logged (SECURITY.md): never
//! SQL text, parameters, cell values or secrets. `logged` records just the command name, so a
//! command's arguments cannot reach the log by accident.

use std::future::Future;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Instant;

use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{InitError, RollingFileAppender, Rotation};
use tracing_subscriber::Layer as _;
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

use crate::error::AppError;

/// When `run` started, for the cold start measurement (NFR-1, task 8.14).
static STARTED: OnceLock<Instant> = OnceLock::new();

/// Records the start of the app; later calls keep the first time.
pub fn mark_start() {
    STARTED.get_or_init(Instant::now);
}

/// Milliseconds from `mark_start` to now, logged as the cold start when the frontend reports
/// that the window is usable. Later calls (a reloaded webview) return the same first value.
pub fn ready() -> u64 {
    static READY: OnceLock<u64> = OnceLock::new();
    *READY.get_or_init(|| {
        let started = *STARTED.get_or_init(Instant::now);
        let startup_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
        tracing::info!(startup_ms, "window usable");
        startup_ms
    })
}

const FILE_PREFIX: &str = "dunlin";
const FILE_SUFFIX: &str = "log";
/// Days of logs kept.
const KEPT_FILES: usize = 7;

/// The appender for `dir`: daily files, the oldest removed beyond `KEPT_FILES`.
pub fn appender(dir: &Path) -> Result<RollingFileAppender, InitError> {
    RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix(FILE_PREFIX)
        .filename_suffix(FILE_SUFFIX)
        .max_log_files(KEPT_FILES)
        .build(dir)
}

/// Starts logging to `dir`. Keep the guard for the life of the app: dropping it flushes and
/// stops the writer thread.
pub fn init(dir: &Path) -> Result<WorkerGuard, InitError> {
    let (writer, guard) = tracing_appender::non_blocking(appender(dir)?);
    // The app's own events at info; dependencies only when they warn.
    let filter = Targets::new()
        .with_target("dunlin_lib", LevelFilter::INFO)
        .with_default(LevelFilter::WARN);
    let layer = tracing_subscriber::fmt::layer()
        .json()
        .with_writer(writer)
        .with_filter(filter);
    // A second init (tests, a reloaded webview) keeps the first subscriber.
    let _ = tracing_subscriber::registry().with(layer).try_init();
    Ok(guard)
}

/// Runs a command and logs its name, how long it took and, on failure, the error code.
pub async fn logged<T>(
    command: &'static str,
    call: impl Future<Output = Result<T, AppError>>,
) -> Result<T, AppError> {
    let started = Instant::now();
    let result = call.await;
    let elapsed_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    match &result {
        Ok(_) => tracing::info!(command, elapsed_ms, "command"),
        Err(error) => tracing::warn!(command, elapsed_ms, code = %error.code, "command failed"),
    }
    result
}

#[cfg(test)]
mod tests;
