//! Secrets live only in the OS keychain (SECURITY.md#secrets), behind [`SecretStore`] so tests
//! can use [`MemorySecretStore`].

use std::collections::HashMap;
use std::sync::Mutex;

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};

use crate::StoreError;

/// Keychain service name (DECISIONS D-014).
pub const KEYCHAIN_SERVICE: &str = "dunlin";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum SecretKind {
    DbPassword,
    SshPassword,
    SshKeyPassphrase,
    /// The jump host's password and key passphrase (one jump host per connection).
    JumpPassword,
    JumpKeyPassphrase,
    TlsKeyPassphrase,
}

impl SecretKind {
    pub const ALL: [SecretKind; 6] = [
        Self::DbPassword,
        Self::SshPassword,
        Self::SshKeyPassphrase,
        Self::JumpPassword,
        Self::JumpKeyPassphrase,
        Self::TlsKeyPassphrase,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::DbPassword => "db_password",
            Self::SshPassword => "ssh_password",
            Self::SshKeyPassphrase => "ssh_key_passphrase",
            Self::JumpPassword => "jump_password",
            Self::JumpKeyPassphrase => "jump_key_passphrase",
            Self::TlsKeyPassphrase => "tls_key_passphrase",
        }
    }

    /// Keychain account: `<connection id>:<secret kind>`.
    pub fn account(self, connection_id: &str) -> String {
        format!("{connection_id}:{}", self.as_str())
    }
}

pub trait SecretStore: Send + Sync {
    fn set(
        &self,
        connection_id: &str,
        kind: SecretKind,
        value: &SecretString,
    ) -> Result<(), StoreError>;
    fn get(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<Option<SecretString>, StoreError>;
    /// Removing a secret that does not exist is not an error.
    fn delete(&self, connection_id: &str, kind: SecretKind) -> Result<(), StoreError>;

    /// Removes every secret of a connection; reports the first failure after trying all.
    fn delete_all(&self, connection_id: &str) -> Result<(), StoreError> {
        let mut first = None;
        for kind in SecretKind::ALL {
            if let Err(error) = self.delete(connection_id, kind) {
                first.get_or_insert(error);
            }
        }
        first.map_or(Ok(()), Err)
    }
}

/// In-memory secrets, for tests and for the E2E backend.
#[derive(Default)]
pub struct MemorySecretStore {
    secrets: Mutex<HashMap<String, SecretString>>,
}

impl MemorySecretStore {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, HashMap<String, SecretString>>, StoreError> {
        self.secrets
            .lock()
            .map_err(|_| StoreError::Keychain("secret store unavailable".into()))
    }

    pub fn len(&self) -> usize {
        self.lock().map(|s| s.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl SecretStore for MemorySecretStore {
    fn set(
        &self,
        connection_id: &str,
        kind: SecretKind,
        value: &SecretString,
    ) -> Result<(), StoreError> {
        let copy = SecretString::from(value.expose_secret().to_owned());
        self.lock()?.insert(kind.account(connection_id), copy);
        Ok(())
    }

    fn get(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<Option<SecretString>, StoreError> {
        Ok(self
            .lock()?
            .get(&kind.account(connection_id))
            .map(|s| SecretString::from(s.expose_secret().to_owned())))
    }

    fn delete(&self, connection_id: &str, kind: SecretKind) -> Result<(), StoreError> {
        self.lock()?.remove(&kind.account(connection_id));
        Ok(())
    }
}

type Credentials = std::sync::Arc<keyring_core::CredentialStore>;
type Connect = fn() -> Result<Credentials, keyring_core::Error>;

/// The OS keychain via `keyring-core`: the macOS keychain, or the Secret Service on Linux
/// (GNOME Keyring, KWallet; D-035). The store connects on first use, so the app starts without
/// a keyring, and a failed connection is retried on the next use.
pub struct KeychainSecretStore {
    connect: Connect,
    store: Mutex<Option<Credentials>>,
}

#[cfg(target_os = "macos")]
fn connect_native() -> Result<Credentials, keyring_core::Error> {
    let store: Credentials = apple_native_keyring_store::keychain::Store::new()?;
    Ok(store)
}

#[cfg(target_os = "linux")]
fn connect_native() -> Result<Credentials, keyring_core::Error> {
    let store: Credentials = zbus_secret_service_keyring_store::Store::new()?;
    Ok(store)
}

impl KeychainSecretStore {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    pub fn open() -> Result<Self, StoreError> {
        let store = Self::with_connect(connect_native);
        // The macOS keychain is always there: fail at start, as before.
        #[cfg(target_os = "macos")]
        store.credentials()?;
        Ok(store)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    pub fn open() -> Result<Self, StoreError> {
        Err(StoreError::Keychain(
            "No keychain is supported on this platform yet".into(),
        ))
    }

    fn with_connect(connect: Connect) -> Self {
        Self {
            connect,
            store: Mutex::new(None),
        }
    }

    fn credentials(&self) -> Result<Credentials, StoreError> {
        let mut slot = self
            .store
            .lock()
            .map_err(|_| StoreError::Keychain("The keychain lock was poisoned".into()))?;
        if let Some(store) = slot.as_ref() {
            return Ok(std::sync::Arc::clone(store));
        }
        let store = (self.connect)().map_err(unavailable)?;
        *slot = Some(std::sync::Arc::clone(&store));
        Ok(store)
    }

    fn entry(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<keyring_core::Entry, StoreError> {
        self.credentials()?
            .build(KEYCHAIN_SERVICE, &kind.account(connection_id), None)
            .map_err(keychain_error)
    }
}

/// The keychain could not be reached at all (no Secret Service on the session bus, say).
fn unavailable(error: keyring_core::Error) -> StoreError {
    let hint = if cfg!(target_os = "linux") {
        ": passwords are kept by the Secret Service; run GNOME Keyring or KWallet in your session"
    } else {
        ""
    };
    match keychain_error(error) {
        StoreError::Keychain(message) => {
            StoreError::Keychain(format!("The keychain is not available ({message}){hint}"))
        }
        other => other,
    }
}

impl SecretStore for KeychainSecretStore {
    fn set(
        &self,
        connection_id: &str,
        kind: SecretKind,
        value: &SecretString,
    ) -> Result<(), StoreError> {
        self.entry(connection_id, kind)?
            .set_password(value.expose_secret())
            .map_err(keychain_error)
    }

    fn get(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<Option<SecretString>, StoreError> {
        match self.entry(connection_id, kind)?.get_password() {
            Ok(password) => Ok(Some(SecretString::from(password))),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(error) => Err(keychain_error(error)),
        }
    }

    fn delete(&self, connection_id: &str, kind: SecretKind) -> Result<(), StoreError> {
        match self.entry(connection_id, kind)?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(error) => Err(keychain_error(error)),
        }
    }
}

/// Never includes secret bytes: `BadEncoding`/`BadDataFormat` carry the stored data.
fn keychain_error(error: keyring_core::Error) -> StoreError {
    let message = match &error {
        keyring_core::Error::BadEncoding(_) | keyring_core::Error::BadDataFormat(..) => {
            "The stored secret is not readable text".to_owned()
        }
        keyring_core::Error::NoStorageAccess(_) => "Access to the keychain was denied".to_owned(),
        other => format!("Keychain error: {other}"),
    };
    StoreError::Keychain(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secret(value: &str) -> SecretString {
        SecretString::from(value.to_owned())
    }

    #[test]
    fn accounts_combine_connection_and_kind() {
        assert_eq!(SecretKind::DbPassword.account("c1"), "c1:db_password");
        assert_eq!(
            SecretKind::TlsKeyPassphrase.account("c1"),
            "c1:tls_key_passphrase"
        );
    }

    #[test]
    fn memory_store_sets_gets_and_deletes() {
        let store = MemorySecretStore::default();

        store
            .set("c1", SecretKind::DbPassword, &secret("p"))
            .unwrap();
        let read = store.get("c1", SecretKind::DbPassword).unwrap();
        store.delete("c1", SecretKind::DbPassword).unwrap();

        assert_eq!(
            read.map(|s| s.expose_secret().to_owned()).as_deref(),
            Some("p")
        );
        assert!(store.get("c1", SecretKind::DbPassword).unwrap().is_none());
    }

    #[test]
    fn delete_all_removes_every_kind_for_one_connection_only() {
        let store = MemorySecretStore::default();
        store
            .set("c1", SecretKind::DbPassword, &secret("a"))
            .unwrap();
        store
            .set("c1", SecretKind::SshPassword, &secret("b"))
            .unwrap();
        store
            .set("c2", SecretKind::DbPassword, &secret("c"))
            .unwrap();

        store.delete_all("c1").unwrap();

        assert_eq!(store.len(), 1);
        assert!(store.get("c2", SecretKind::DbPassword).unwrap().is_some());
    }

    #[test]
    fn deleting_a_missing_secret_is_fine() {
        assert!(
            MemorySecretStore::default()
                .delete("x", SecretKind::DbPassword)
                .is_ok()
        );
    }

    #[test]
    fn keychain_errors_never_carry_secret_bytes() {
        let error = keychain_error(keyring_core::Error::BadEncoding(b"hunter2".to_vec()));

        assert!(!error.to_string().contains("hunter2"));
    }

    use std::sync::atomic::{AtomicUsize, Ordering};

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
        let store = KeychainSecretStore::with_connect(no_service);

        let first = store.get("c1", SecretKind::DbPassword).unwrap_err();
        let second = store
            .set("c1", SecretKind::DbPassword, &secret("x"))
            .unwrap_err();

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
        let store = KeychainSecretStore::with_connect(mock_service);
        assert_eq!(GOOD_CONNECTS.load(Ordering::SeqCst), 0, "not at open");

        store.get("c1", SecretKind::DbPassword).unwrap();
        store.get("c2", SecretKind::SshPassword).unwrap();

        assert_eq!(GOOD_CONNECTS.load(Ordering::SeqCst), 1);
    }

    /// Uses the real keychain (macOS) or Secret Service (Linux; CI runs it under
    /// `dbus-run-session` with GNOME Keyring). By hand: `cargo test -p dbc-store keychain -- --ignored`.
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[test]
    #[ignore = "touches the real keychain"]
    fn keychain_round_trip() {
        let store = KeychainSecretStore::open().unwrap();
        let id = format!("test-{}", uuid::Uuid::new_v4());

        store
            .set(&id, SecretKind::DbPassword, &secret("round-trip"))
            .unwrap();
        let read = store.get(&id, SecretKind::DbPassword).unwrap();
        store.delete_all(&id).unwrap();

        assert_eq!(
            read.map(|s| s.expose_secret().to_owned()).as_deref(),
            Some("round-trip")
        );
        assert!(store.get(&id, SecretKind::DbPassword).unwrap().is_none());
    }
}
