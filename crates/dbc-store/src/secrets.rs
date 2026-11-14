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

/// The OS keychain via `keyring-core`. macOS only for now (NFR-5: others in Phase 8).
pub struct KeychainSecretStore {
    store: std::sync::Arc<keyring_core::CredentialStore>,
}

impl KeychainSecretStore {
    #[cfg(target_os = "macos")]
    pub fn open() -> Result<Self, StoreError> {
        let store = apple_native_keyring_store::keychain::Store::new().map_err(keychain_error)?;
        Ok(Self { store })
    }

    #[cfg(not(target_os = "macos"))]
    pub fn open() -> Result<Self, StoreError> {
        Err(StoreError::Keychain(
            "No keychain is supported on this platform yet".into(),
        ))
    }

    fn entry(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<keyring_core::Entry, StoreError> {
        self.store
            .build(KEYCHAIN_SERVICE, &kind.account(connection_id), None)
            .map_err(keychain_error)
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

    /// Uses the real macOS keychain; run by hand: `cargo test -p dbc-store keychain -- --ignored`.
    #[cfg(target_os = "macos")]
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
