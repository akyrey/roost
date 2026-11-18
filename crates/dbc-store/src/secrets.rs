//! Secrets live only in the OS keychain (SECURITY.md#secrets), behind [`SecretStore`] so tests
//! can use [`MemorySecretStore`]. The keychain itself is `roost-keychain`; this module names
//! Dunlin's secrets: one account per connection and kind.

use roost_keychain::KeychainError;
use secrecy::SecretString;
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

impl From<KeychainError> for StoreError {
    fn from(KeychainError(message): KeychainError) -> Self {
        StoreError::Keychain(message)
    }
}

/// Dunlin's secrets in a `roost-keychain` store.
#[derive(Default)]
pub struct ConnectionSecrets<S>(S);

/// In-memory secrets, for tests and for the E2E backend.
pub type MemorySecretStore = ConnectionSecrets<roost_keychain::MemorySecretStore>;

/// The OS keychain (D-035).
pub type KeychainSecretStore = ConnectionSecrets<roost_keychain::KeychainSecretStore>;

impl MemorySecretStore {
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl KeychainSecretStore {
    pub fn open() -> Result<Self, StoreError> {
        Ok(Self(roost_keychain::KeychainSecretStore::open(
            KEYCHAIN_SERVICE,
        )?))
    }
}

impl<S: roost_keychain::SecretStore> SecretStore for ConnectionSecrets<S> {
    fn set(
        &self,
        connection_id: &str,
        kind: SecretKind,
        value: &SecretString,
    ) -> Result<(), StoreError> {
        Ok(self.0.set(&kind.account(connection_id), value)?)
    }

    fn get(
        &self,
        connection_id: &str,
        kind: SecretKind,
    ) -> Result<Option<SecretString>, StoreError> {
        Ok(self.0.get(&kind.account(connection_id))?)
    }

    fn delete(&self, connection_id: &str, kind: SecretKind) -> Result<(), StoreError> {
        Ok(self.0.delete(&kind.account(connection_id))?)
    }
}

#[cfg(test)]
mod tests {
    use secrecy::ExposeSecret;

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
    fn keychain_failures_become_store_errors() {
        let error = StoreError::from(KeychainError("Access to the keychain was denied".into()));

        assert_eq!(
            error.to_string(),
            StoreError::Keychain("Access to the keychain was denied".into()).to_string()
        );
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
