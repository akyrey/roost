//! Secrets live only in the OS keychain, behind [`SecretStore`] so tests can use
//! [`MemorySecretStore`]. An app picks its service name; accounts are its own keys.
//!
//! Part of the shared kit (Roost): depends on no app crate.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};

use secrecy::{ExposeSecret, SecretString};

/// A keychain failure, safe to show: it never holds secret bytes.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{0}")]
pub struct KeychainError(pub String);

pub trait SecretStore: Send + Sync {
    fn set(&self, account: &str, value: &SecretString) -> Result<(), KeychainError>;
    fn get(&self, account: &str) -> Result<Option<SecretString>, KeychainError>;
    /// Removing a secret that does not exist is not an error.
    fn delete(&self, account: &str) -> Result<(), KeychainError>;
}

fn copy(secret: &SecretString) -> SecretString {
    SecretString::from(secret.expose_secret().to_owned())
}

/// In-memory secrets, for tests and for E2E backends.
#[derive(Default)]
pub struct MemorySecretStore {
    secrets: Mutex<HashMap<String, SecretString>>,
}

impl MemorySecretStore {
    fn lock(&self) -> Result<MutexGuard<'_, HashMap<String, SecretString>>, KeychainError> {
        self.secrets
            .lock()
            .map_err(|_| KeychainError("secret store unavailable".into()))
    }

    pub fn len(&self) -> usize {
        self.lock().map(|s| s.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl SecretStore for MemorySecretStore {
    fn set(&self, account: &str, value: &SecretString) -> Result<(), KeychainError> {
        self.lock()?.insert(account.to_owned(), copy(value));
        Ok(())
    }

    fn get(&self, account: &str) -> Result<Option<SecretString>, KeychainError> {
        Ok(self.lock()?.get(account).map(copy))
    }

    fn delete(&self, account: &str) -> Result<(), KeychainError> {
        self.lock()?.remove(account);
        Ok(())
    }
}

type Credentials = Arc<keyring_core::CredentialStore>;
type Connect = fn() -> Result<Credentials, keyring_core::Error>;

/// The OS keychain via `keyring-core`: the macOS keychain, or the Secret Service on Linux
/// (GNOME Keyring, KWallet). The store connects on first use, so the app starts without a
/// keyring, and a failed connection is retried on the next use.
pub struct KeychainSecretStore {
    service: String,
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
    /// The keychain under `service` (the app's name, e.g. `dunlin`).
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    pub fn open(service: &str) -> Result<Self, KeychainError> {
        let store = Self::with_connect(service, connect_native);
        // The macOS keychain is always there: fail at start.
        #[cfg(target_os = "macos")]
        store.credentials()?;
        Ok(store)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    pub fn open(_service: &str) -> Result<Self, KeychainError> {
        Err(KeychainError(
            "No keychain is supported on this platform yet".into(),
        ))
    }

    fn with_connect(service: &str, connect: Connect) -> Self {
        Self {
            service: service.to_owned(),
            connect,
            store: Mutex::new(None),
        }
    }

    fn credentials(&self) -> Result<Credentials, KeychainError> {
        let mut slot = self
            .store
            .lock()
            .map_err(|_| KeychainError("The keychain lock was poisoned".into()))?;
        if let Some(store) = slot.as_ref() {
            return Ok(Arc::clone(store));
        }
        let store = (self.connect)().map_err(unavailable)?;
        *slot = Some(Arc::clone(&store));
        Ok(store)
    }

    fn entry(&self, account: &str) -> Result<keyring_core::Entry, KeychainError> {
        self.credentials()?
            .build(&self.service, account, None)
            .map_err(keychain_error)
    }
}

/// The keychain could not be reached at all (no Secret Service on the session bus, say).
fn unavailable(error: keyring_core::Error) -> KeychainError {
    let hint = if cfg!(target_os = "linux") {
        ": passwords are kept by the Secret Service; run GNOME Keyring or KWallet in your session"
    } else {
        ""
    };
    let KeychainError(message) = keychain_error(error);
    KeychainError(format!("The keychain is not available ({message}){hint}"))
}

impl SecretStore for KeychainSecretStore {
    fn set(&self, account: &str, value: &SecretString) -> Result<(), KeychainError> {
        self.entry(account)?
            .set_password(value.expose_secret())
            .map_err(keychain_error)
    }

    fn get(&self, account: &str) -> Result<Option<SecretString>, KeychainError> {
        match self.entry(account)?.get_password() {
            Ok(password) => Ok(Some(SecretString::from(password))),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(error) => Err(keychain_error(error)),
        }
    }

    fn delete(&self, account: &str) -> Result<(), KeychainError> {
        match self.entry(account)?.delete_credential() {
            Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
            Err(error) => Err(keychain_error(error)),
        }
    }
}

/// Never includes secret bytes: `BadEncoding`/`BadDataFormat` carry the stored data.
fn keychain_error(error: keyring_core::Error) -> KeychainError {
    let message = match &error {
        keyring_core::Error::BadEncoding(_) | keyring_core::Error::BadDataFormat(..) => {
            "The stored secret is not readable text".to_owned()
        }
        keyring_core::Error::NoStorageAccess(_) => "Access to the keychain was denied".to_owned(),
        other => format!("Keychain error: {other}"),
    };
    KeychainError(message)
}

#[cfg(test)]
mod tests;
