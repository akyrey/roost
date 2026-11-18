//! The desktop shell shared by Dunlin and Whimbrel (the Roost kit): signed in-app updates from
//! the app's GitHub release, and JSON log files. Depends on no app crate; each app maps
//! [`ShellError`] into its own IPC error.

pub mod logging;
pub mod updates;

/// A failure an app reports to its frontend: a stable `snake_case` code and a message safe to
/// show (no secrets, no user data).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{code}: {message}")]
pub struct ShellError {
    pub code: &'static str,
    pub message: String,
}

impl ShellError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
