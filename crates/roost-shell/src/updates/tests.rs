#![allow(clippy::unwrap_used, clippy::expect_used)]

use tauri::test::{MockRuntime, mock_builder, mock_context, noop_assets};
use tauri_plugin_updater::UpdaterExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use super::*;

/// The release key's public half; no test download is signed with it.
const PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDZEQTBCNEYzNDlGRDRGNEYKUldSUFQvMUo4N1NnYlpLV0Zrb0ZielRpWXFsZUkyc3ljQnJSUnhneVZRT1pYTzc0OVlra2RMVzkK";

/// A signature from another key, in the `.sig` file format.
const FOREIGN_SIGNATURE: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVSUFQvMUo4N1NnYlVTNTdsb2x6YkthMjNYZlNna1VNVzNaQ1V3dW4wdHhBMFJXMmpxRWE4K0NjMWhLaVk2UGhwekF5YUV3YTBVQ2tpYmJLYTA4RzE2L2I4bkF3UHp1VEFzPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzk0NzgxMTYwCWZpbGU6Zi50eHQKUTFXQlNianRFVG42N2RwQXlTUEV4Zi9KT1lqbk9tOTl0czA2akpMbi9jVExKQm9OWWRVWlFvTFRqUUQrYkxwVlhMWW13Nll2N3NEOTA3dE1JdkxmQXc9PQo=";

/// Serves `manifest` at `/latest.json` with `status`, and a few bytes at `/package`.
async fn release_server(status: u16, manifest: String) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            let manifest = manifest.clone();
            tokio::spawn(async move {
                let mut request = vec![0; 4096];
                let read = socket.read(&mut request).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&request[..read]);
                let (status, body) = if request.starts_with("GET /latest.json") {
                    (status, manifest)
                } else {
                    (200, "not a real package".to_owned())
                };
                let response = format!(
                    "HTTP/1.1 {status} X\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = socket.write_all(response.as_bytes()).await;
            });
        }
    });
    base
}

fn manifest(base: &str, version: &str) -> String {
    let platform = tauri_plugin_updater::target().unwrap();
    serde_json::json!({
        "version": version,
        "notes": "Faster grids.",
        "platforms": { platform: { "url": format!("{base}/package"), "signature": FOREIGN_SIGNATURE } }
    })
    .to_string()
}

fn app() -> tauri::App<MockRuntime> {
    let mut context = mock_context(noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".to_owned(),
        serde_json::json!({ "pubkey": PUBKEY }),
    );
    mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap()
}

fn updater(
    app: &tauri::App<MockRuntime>,
    base: &str,
) -> Result<Updater, tauri_plugin_updater::Error> {
    let endpoint = format!("{base}/latest.json").parse().unwrap();
    app.updater_builder().endpoints(vec![endpoint])?.build()
}

#[tokio::test]
async fn reports_and_remembers_a_newer_version() {
    let base = release_server(200, String::new()).await;
    let base = release_server(200, manifest(&base, "999.0.0")).await;
    let app = app();
    let pending = PendingUpdate::new("Test");

    let info = check(updater(&app, &base), &pending)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(info.version, "999.0.0");
    assert_eq!(info.current_version, app.package_info().version.to_string());
    assert_eq!(info.notes.as_deref(), Some("Faster grids."));
    assert_eq!(pending.current().unwrap().version, "999.0.0");
}

#[tokio::test]
async fn an_older_or_equal_version_is_not_an_update_and_forgets_the_last_one() {
    let base = release_server(200, String::new()).await;
    let newer = release_server(200, manifest(&base, "999.0.0")).await;
    let current = app().package_info().version.to_string();
    let same = release_server(200, manifest(&base, &current)).await;
    let app = app();
    let pending = PendingUpdate::new("Test");
    check(updater(&app, &newer), &pending).await.unwrap();

    let info = check(updater(&app, &same), &pending).await.unwrap();

    assert_eq!(info, None);
    assert_eq!(pending.current().err().map(|e| e.code), Some("not_found"));
}

#[tokio::test]
async fn a_server_error_is_reported_as_update_failed() {
    let base = release_server(404, "Not Found".to_owned()).await;
    let app = app();

    let error = check(updater(&app, &base), &PendingUpdate::new("Test"))
        .await
        .unwrap_err();

    assert_eq!(error.code, "update_failed");
    assert!(
        error.message.starts_with("Could not check for updates"),
        "{}",
        error.message
    );
}

#[tokio::test]
async fn installing_without_a_checked_update_is_not_found() {
    let error = install(&PendingUpdate::new("Test"), |_| {})
        .await
        .unwrap_err();

    assert_eq!(error.code, "not_found");
}

#[tokio::test]
async fn refuses_a_download_whose_signature_is_not_from_the_release_key() {
    let base = release_server(200, String::new()).await;
    let base_with_manifest = release_server(200, manifest(&base, "999.0.0")).await;
    let app = app();
    let pending = PendingUpdate::new("Test");
    check(updater(&app, &base_with_manifest), &pending)
        .await
        .unwrap();
    let mut reported = 0;

    let error = install(&pending, |progress| reported = progress.downloaded)
        .await
        .unwrap_err();

    assert_eq!(error.code, "update_failed");
    assert_eq!(reported, "not a real package".len() as u64);
    // Still remembered, so the user can retry.
    assert!(pending.current().is_ok());
}
