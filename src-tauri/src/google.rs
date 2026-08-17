use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpListener;

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoogleUserProfile {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCalendarItem {
    pub id: String,
    pub summary: String,
    #[serde(rename = "backgroundColor")]
    pub background_color: Option<String>,
    #[serde(rename = "foregroundColor")]
    pub foreground_color: Option<String>,
    pub primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCalendarListResponse {
    pub items: Vec<GoogleCalendarItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleAuthResult {
    pub profile: GoogleUserProfile,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub calendars: Vec<GoogleCalendarItem>,
}

#[tauri::command]
pub async fn start_google_auth(
    client_id: String,
    client_secret: String,
) -> Result<GoogleAuthResult, String> {
    let redirect_uri = "http://127.0.0.1:8080/oauth/callback";
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/calendar+https://www.googleapis.com/auth/userinfo.profile+https://www.googleapis.com/auth/userinfo.email&access_type=offline&prompt=consent",
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri)
    );

    // 1. Open default browser to Google's consent screen
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }

    // 2. Start local TCP loopback listener on port 8080
    let listener = TcpListener::bind("127.0.0.1:8080")
        .map_err(|e| format!("Failed to bind local loopback port 8080: {}", e))?;

    let mut auth_code: Option<String> = None;

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let mut buffer = [0; 2048];
                let bytes_read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                if let Some(code_idx) = request.find("code=") {
                    let after_code = &request[code_idx + 5..];
                    let end_idx = after_code.find('&').or_else(|| after_code.find(' ')).unwrap_or(after_code.len());
                    let code = after_code[..end_idx].to_string();

                    auth_code = Some(urlencoding::decode(&code).unwrap_or_default().to_string());

                    let response_html = "<!DOCTYPE html><html><body style='background:#121212;color:#fff;font-family:sans-serif;text-align:center;padding-top:100px;'><h1>Authentication Successful</h1><p>You can close this tab and return to Kairo.</p></body></html>";
                    let http_response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        response_html.len(),
                        response_html
                    );
                    let _ = stream.write_all(http_response.as_bytes());
                    let _ = stream.flush();
                    break;
                }
            }
            Err(e) => return Err(format!("TCP connection error: {}", e)),
        }
    }

    let code = auth_code.ok_or_else(|| "Failed to capture Google authorization code".to_string())?;

    // 3. Exchange code for access & refresh tokens
    let http_client = reqwest::Client::new();
    let token_params = [
        ("code", code.as_str()),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];

    let token_res = http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&token_params)
        .send()
        .await
        .map_err(|e| format!("Token network error: {}", e))?;

    if !token_res.status().is_success() {
        let err_text = token_res.text().await.unwrap_or_default();
        return Err(format!("Google token exchange rejected: {}", err_text));
    }

    let token_data: GoogleTokenResponse = token_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    // 4. Fetch Profile
    let profile_res = http_client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&token_data.access_token)
        .send()
        .await
        .map_err(|e| format!("Profile error: {}", e))?;

    let profile: GoogleUserProfile = profile_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse profile JSON: {}", e))?;

    // 5. Fetch User's Google Calendar List
    let calendars_res = http_client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&token_data.access_token)
        .send()
        .await;

    let calendars = match calendars_res {
        Ok(res) => {
            let list: GoogleCalendarListResponse = res.json().await.unwrap_or(GoogleCalendarListResponse { items: vec![] });
            list.items
        }
        Err(_) => vec![],
    };

    Ok(GoogleAuthResult {
        profile,
        access_token: token_data.access_token,
        refresh_token: token_data.refresh_token,
        calendars,
    })
}