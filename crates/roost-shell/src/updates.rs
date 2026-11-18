//! Checking for, downloading and installing updates from the app's GitHub release.
//!
//! `check` remembers the update it found so `install` installs exactly what the user was shown.
//! The updater verifies every download against the public key in `tauri.conf.json` before
//! installing it.

use std::sync::Mutex;

use serde::Serialize;
use tauri_plugin_updater::{Update, Updater};

use crate::ShellError;

/// A newer version announced by the release server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    /// The release notes: the changelog section of that version.
    pub notes: Option<String>,
}

/// Sent on the progress channel of `update_install` after each downloaded chunk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub downloaded: u64,
    /// `None` when the server does not send a length.
    #[cfg_attr(feature = "ts", ts(type = "number | null"))]
    pub total: Option<u64>,
}

/// The update found by the last check, if any.
pub struct PendingUpdate {
    app_name: &'static str,
    update: Mutex<Option<Update>>,
}

impl PendingUpdate {
    /// `app_name` is named in the one message that asks for a restart.
    pub fn new(app_name: &'static str) -> Self {
        Self {
            app_name,
            update: Mutex::new(None),
        }
    }

    fn replace(&self, update: Option<Update>) -> Result<(), ShellError> {
        *self.update.lock().map_err(|_| self.poisoned())? = update;
        Ok(())
    }

    /// A copy of the remembered update; it stays remembered so a failed install can be retried.
    fn current(&self) -> Result<Update, ShellError> {
        self.update
            .lock()
            .map_err(|_| self.poisoned())?
            .clone()
            .ok_or_else(|| {
                ShellError::new(
                    "not_found",
                    "No update is waiting to be installed. Check for updates again.",
                )
            })
    }

    fn poisoned(&self) -> ShellError {
        ShellError::new(
            "internal",
            format!(
                "The update state is unusable. Restart {} and try again.",
                self.app_name
            ),
        )
    }
}

fn info_of(update: &Update) -> UpdateInfo {
    UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
    }
}

/// Asks the release server for a newer version and remembers it. `None` means up to date.
pub async fn check(
    updater: Result<Updater, tauri_plugin_updater::Error>,
    pending: &PendingUpdate,
) -> Result<Option<UpdateInfo>, ShellError> {
    let updater = updater.map_err(|e| update_failed("check for updates", &e))?;
    let found = updater
        .check()
        .await
        .map_err(|e| update_failed("check for updates", &e))?;
    let info = found.as_ref().map(info_of);
    pending.replace(found)?;
    Ok(info)
}

/// Downloads, verifies and installs the remembered update. The caller restarts the app.
pub async fn install(
    pending: &PendingUpdate,
    mut progress: impl FnMut(UpdateProgress),
) -> Result<(), ShellError> {
    let update = pending.current()?;
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            |chunk, total| {
                downloaded = downloaded.saturating_add(u64::try_from(chunk).unwrap_or(u64::MAX));
                progress(UpdateProgress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| update_failed("install the update", &e))
}

fn update_failed(action: &str, error: &tauri_plugin_updater::Error) -> ShellError {
    // Updater errors name URLs and files, never secrets or database values.
    ShellError::new("update_failed", format!("Could not {action}: {error}"))
}

#[cfg(test)]
mod tests;
