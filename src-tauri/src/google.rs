use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct AuthResponse {
    pub success: bool,
    pub email: String,
}

#[command]
pub async fn start_google_oauth(client_id: String) -> Result<AuthResponse, String> {
    // 1. Open Google Auth URL with PKCE & Calendar scope:
    // https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=http://127.0.0.1:8989&response_type=code&scope=https://www.googleapis.com/auth/calendar
    // 2. Exchange code for access_token & refresh_token
    // 3. Store refresh token in native OS Keyring via `keyring` crate
    
    Ok(AuthResponse {
        success: true,
        email: "amilavaz2003@gmail.com".to_string(),
    })
}