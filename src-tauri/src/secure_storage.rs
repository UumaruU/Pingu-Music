use keyring::{Entry, Error as KeyringError};

const KEYRING_SERVICE: &str = "com.pingu.music.auth";

fn keyring_entry(key: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, key).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_secure_value(key: String, value: String) -> Result<(), String> {
    let entry = keyring_entry(&key)?;
    entry
        .set_password(&value)
        .map_err(|error| format!("failed to save secure value: {error}"))
}

#[tauri::command]
pub fn read_secure_value(key: String) -> Result<Option<String>, String> {
    let entry = keyring_entry(&key)?;

    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("failed to read secure value: {error}")),
    }
}

#[tauri::command]
pub fn delete_secure_value(key: String) -> Result<(), String> {
    let entry = keyring_entry(&key)?;

    match entry.delete_password() {
        Ok(_) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("failed to delete secure value: {error}")),
    }
}
