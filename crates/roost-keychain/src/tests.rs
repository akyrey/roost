#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::sync::atomic::{AtomicUsize, Ordering};

use super::*;

fn secret(value: &str) -> SecretString {
    SecretString::from(value.to_owned())
}

fn exposed(secret: Option<SecretString>) -> Option<String> {
    secret.map(|s| s.expose_secret().to_owned())
}

#[test]
fn memory_store_sets_gets_and_deletes() {
    let store = MemorySecretStore::default();

    store.set("a", &secret("p")).unwrap();
    let read = store.get("a").unwrap();
    store.delete("a").unwrap();

    assert_eq!(exposed(read).as_deref(), Some("p"));
    assert!(store.get("a").unwrap().is_none());
    assert!(store.is_empty());
}

#[test]
fn deleting_a_missing_secret_is_fine() {
    assert!(MemorySecretStore::default().delete("x").is_ok());
}

#[test]
fn keychain_errors_never_carry_secret_bytes() {
    let error = keychain_error(keyring_core::Error::BadEncoding(b"hunter2".to_vec()));

    assert!(!error.to_string().contains("hunter2"));
}

static FAILED_CONNECTS: AtomicUsize = AtomicUsize::new(0);
static GOOD_CONNECTS: AtomicUsize = AtomicUsize::new(0);

fn no_service() -> Result<Credentials, keyring_core::Error> {
    FAILED_CONNECTS.fetch_add(1, Ordering::SeqCst);
    Err(keyring_core::Error::NoStorageAccess(
        "org.freedesktop.secrets was not provided by any .service files".into(),
    ))
}

fn mock_service() -> Result<Credentials, keyring_core::Error> {
    GOOD_CONNECTS.fetch_add(1, Ordering::SeqCst);
    let store: Credentials = keyring_core::mock::Store::new()?;
    Ok(store)
}

#[test]
fn a_missing_keyring_fails_each_use_with_a_hint_and_is_retried() {
    let store = KeychainSecretStore::with_connect("test", no_service);

    let first = store.get("a").unwrap_err();
    let second = store.set("a", &secret("x")).unwrap_err();

    assert!(
        first.to_string().contains("The keychain is not available"),
        "{first}"
    );
    assert!(second.to_string().contains("not available"));
    assert_eq!(
        FAILED_CONNECTS.load(Ordering::SeqCst),
        2,
        "retried on each use"
    );
}

#[test]
fn the_store_connects_once_on_first_use() {
    let store = KeychainSecretStore::with_connect("test", mock_service);
    assert_eq!(GOOD_CONNECTS.load(Ordering::SeqCst), 0, "not at open");

    store.get("a").unwrap();
    store.get("b").unwrap();

    assert_eq!(GOOD_CONNECTS.load(Ordering::SeqCst), 1);
}

/// Uses the real keychain (macOS) or Secret Service (Linux). By hand:
/// `cargo test -p roost-keychain -- --ignored`.
#[cfg(any(target_os = "macos", target_os = "linux"))]
#[test]
#[ignore = "touches the real keychain"]
fn keychain_round_trip() {
    let store = KeychainSecretStore::open("roost-test").unwrap();
    let account = format!("test-{}", uuid::Uuid::new_v4());

    store.set(&account, &secret("round-trip")).unwrap();
    let read = store.get(&account).unwrap();
    store.delete(&account).unwrap();

    assert_eq!(exposed(read).as_deref(), Some("round-trip"));
    assert!(store.get(&account).unwrap().is_none());
}

fn mock_store() -> Result<Credentials, keyring_core::Error> {
    let store: Credentials = keyring_core::mock::Store::new()?;
    Ok(store)
}

#[test]
fn the_keychain_store_round_trips_through_its_backend() {
    // keyring-core's mock keeps one entry per (service, account) for the life of the store.
    let store = KeychainSecretStore::with_connect("test", mock_store);

    store.set("a", &secret("p")).unwrap();
    let read = store.get("a").unwrap();
    store.delete("a").unwrap();
    store.delete("never-set").unwrap();

    assert_eq!(exposed(read).as_deref(), Some("p"));
    assert_eq!(exposed(store.get("a").unwrap()), None);
}

#[test]
fn keychain_errors_name_the_problem() {
    assert_eq!(
        keychain_error(keyring_core::Error::NoStorageAccess("x".into())).0,
        "Access to the keychain was denied"
    );
    assert!(
        keychain_error(keyring_core::Error::NoEntry)
            .0
            .starts_with("Keychain error:")
    );
}
