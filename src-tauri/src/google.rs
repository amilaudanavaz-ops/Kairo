use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ==========================================
// PLACE YOUR GOOGLE CLIENT CREDENTIALS HERE
// ==========================================
pub const GOOGLE_CLIENT_ID: &str = "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com";
pub const GOOGLE_CLIENT_SECRET: &str = "YOUR_GOOGLE_CLIENT_SECRET_HERE";
pub const GOOGLE_REDIRECT_URI: &str = "http://localhost:8080/oauth/callback";

#[derive(Default)]
pub struct GoogleAuthState {
    pub access_token: Mutex<Option<String>>,
    pub refresh_token: Mutex<Option<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleUserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

#[tauri::command]
pub fn get_google_auth_url() -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/calendar+https://www.googleapis.com/auth/userinfo.profile+https://www.googleapis.com/auth/userinfo.email&access_type=offline&prompt=consent",
        GOOGLE_CLIENT_ID,
        urlencoding::encode(GOOGLE_REDIRECT_URI)
    )
}

#[tauri::command]
pub async fn exchange_google_code(code: String) -> Result<GoogleUserProfile, String> {
    let client = reqwest::Client::new();
    let params = [
        ("code", code.as_str()),
        ("client_id", GOOGLE_CLIENT_ID),
        ("client_secret", GOOGLE_CLIENT_SECRET),
        ("redirect_uri", GOOGLE_REDIRECT_URI),
        ("grant_type", "authorization_code"),
    ];

    let token_res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to request token: {}", e))?;

    if !token_res.status().is_success() {
        let err_text = token_res.text().await.unwrap_or_default();
        return Err(format!("Token exchange error: {}", err_text));
    }

    let token_data: GoogleTokenResponse = token_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let profile_res = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&token_data.access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user profile: {}", e))?;

    let profile: GoogleUserProfile = profile_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse profile: {}", e))?;

    Ok(profile)
}