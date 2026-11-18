//! Log files: JSON lines in the app's log folder, one file a day, the last week kept.
//!
//! `logged` records just a command's name, duration and error code, so neither its arguments
//! nor its error message (which may quote user data) can reach the log by accident.

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

/// What `logged` records of a failure: its stable code, never its message.
pub trait ErrorCode {
    fn code(&self) -> &str;
}

impl ErrorCode for crate::ShellError {
    fn code(&self) -> &str {
        self.code
    }
}

/// Where an app's logs go and which of its events are kept.
#[derive(Debug, Clone, Copy)]
pub struct LogConfig {
    /// Log files are `<prefix>.<date>.log`.
    pub file_prefix: &'static str,
    /// The app's crate name (its tracing target), logged at info; others only when they warn.
    pub app_target: &'static str,
}

/// When `run` started, for the cold start measurement.
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

const FILE_SUFFIX: &str = "log";
/// Days of logs kept.
const KEPT_FILES: usize = 7;

/// The appender for `dir`: daily files, the oldest removed beyond `KEPT_FILES`.
pub fn appender(dir: &Path, file_prefix: &str) -> Result<RollingFileAppender, InitError> {
    RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix(file_prefix)
        .filename_suffix(FILE_SUFFIX)
        .max_log_files(KEPT_FILES)
        .build(dir)
}

/// Starts logging to `dir`. Keep the guard for the life of the app: dropping it flushes and
/// stops the writer thread.
pub fn init(dir: &Path, config: LogConfig) -> Result<WorkerGuard, InitError> {
    let (writer, guard) = tracing_appender::non_blocking(appender(dir, config.file_prefix)?);
    // The app's own events at info; dependencies only when they warn.
    let filter = Targets::new()
        .with_target(config.app_target, LevelFilter::INFO)
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
pub async fn logged<T, E: ErrorCode>(
    command: &'static str,
    call: impl Future<Output = Result<T, E>>,
) -> Result<T, E> {
    let started = Instant::now();
    let result = call.await;
    let elapsed_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    match &result {
        Ok(_) => tracing::info!(command, elapsed_ms, "command"),
        Err(error) => tracing::warn!(command, elapsed_ms, code = error.code(), "command failed"),
    }
    result
}

#[cfg(test)]
mod tests;
