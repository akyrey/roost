//! Checking for, downloading and installing updates from the GitHub release (D-036), through
//! `roost-shell`. `check` remembers the update it found so `install` installs exactly what the
//! user was shown; the updater verifies every download against the public key in
//! `tauri.conf.json` before installing it.

use roost_shell::updates;
use tauri_plugin_updater::Updater;

pub use roost_shell::updates::{PendingUpdate, UpdateInfo, UpdateProgress};

use crate::error::AppError;

/// The update state, named for the one message that asks for a restart.
pub fn pending() -> PendingUpdate {
    PendingUpdate::new("Dunlin")
}

/// Asks the release server for a newer version and remembers it. `None` means up to date.
pub async fn check(
    updater: Result<Updater, tauri_plugin_updater::Error>,
    pending: &PendingUpdate,
) -> Result<Option<UpdateInfo>, AppError> {
    Ok(updates::check(updater, pending).await?)
}

/// Downloads, verifies and installs the remembered update. The caller restarts the app.
pub async fn install(
    pending: &PendingUpdate,
    progress: impl FnMut(UpdateProgress),
) -> Result<(), AppError> {
    Ok(updates::install(pending, progress).await?)
}
