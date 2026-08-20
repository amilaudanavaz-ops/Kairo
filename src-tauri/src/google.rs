use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpListener;

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    #[serde(alias = "accessToken")]
    pub access_token: String,
    #[serde(alias = "tokenType")]
    pub token_type: String,
    #[serde(alias = "expiresIn")]
    pub expires_in: Option<u64>,
    #[serde(alias = "refreshToken")]
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoogleUserProfile {
    #[serde(alias = "sub")]
    pub id: String,
    pub email: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoogleCalendarItem {
    pub id: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(alias = "backgroundColor")]
    pub background_color: Option<String>,
    #[serde(alias = "foregroundColor")]
    pub foreground_color: Option<String>,
    pub primary: Option<bool>,
    #[serde(alias = "accessRole")]
    pub access_role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCalendarListResponse {
    #[serde(default)]
    pub items: Vec<GoogleCalendarItem>,
    #[serde(alias = "nextPageToken")]
    pub next_page_token: Option<String>,
    #[serde(alias = "nextSyncToken")]
    pub next_sync_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NormalizedGoogleEvent {
    pub google_event_id: String,
    pub recurring_event_id: Option<String>,
    pub original_start_time: Option<String>,
    pub rrule: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub meeting_url: Option<String>,
    pub conferencing_provider: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub is_all_day: bool,
    pub time_zone: String,
    pub status: String,
    pub busy_status: String,
    pub color_override: Option<String>,
    pub etag: Option<String>,
    pub participants: Vec<String>,
    pub reminders: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventsFetchResponse {
    pub events: Vec<NormalizedGoogleEvent>,
    pub next_sync_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventMutationPayload {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    #[serde(alias = "startTime")]
    pub start_time: String,
    #[serde(alias = "endTime")]
    pub end_time: String,
    #[serde(alias = "isAllDay")]
    pub is_all_day: bool,
    #[serde(alias = "timeZone")]
    pub time_zone: Option<String>,
    pub rrule: Option<String>,
    #[serde(alias = "recurringEventId")]
    pub recurring_event_id: Option<String>,
    #[serde(alias = "originalStartTime")]
    pub original_start_time: Option<String>,
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

    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }

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

    let calendars_res = http_client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&token_data.access_token)
        .send()
        .await;

    let calendars = match calendars_res {
        Ok(res) => {
            let list: GoogleCalendarListResponse = res.json().await.unwrap_or(GoogleCalendarListResponse {
                items: vec![],
                next_page_token: None,
                next_sync_token: None,
            });
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

#[tauri::command]
pub async fn refresh_google_token(
    client_id: String,
    client_secret: String,
    refresh_token: String,
) -> Result<GoogleTokenResponse, String> {
    let http_client = reqwest::Client::new();
    let params = [
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("refresh_token", refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ];

    let res = http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token refresh request error: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed: {}", err));
    }

    res.json::<GoogleTokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse refreshed token: {}", e))
}

#[tauri::command]
pub async fn fetch_google_calendars(
    access_token: String,
) -> Result<Vec<GoogleCalendarItem>, String> {
    let http_client = reqwest::Client::new();
    let res = http_client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| format!("Calendar list fetch error: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Failed to retrieve calendars: {}", err));
    }

    let list: GoogleCalendarListResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse calendar list: {}", e))?;

    Ok(list.items)
}

#[tauri::command]
pub async fn fetch_google_events(
    access_token: String,
    calendar_id: String,
    time_min: Option<String>,
    time_max: Option<String>,
    sync_token: Option<String>,
) -> Result<GoogleEventsFetchResponse, String> {
    let http_client = reqwest::Client::new();
    let encoded_cal_id = urlencoding::encode(&calendar_id);

    // Fetch master events with singleEvents=false to let local dateMath project series
    let url_events = if let Some(ref st) = sync_token {
        format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events?singleEvents=false&maxResults=2500&syncToken={}",
            encoded_cal_id,
            urlencoding::encode(st)
        )
    } else {
        let mut url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events?singleEvents=false&maxResults=2500",
            encoded_cal_id
        );
        if let Some(ref min) = time_min {
            url.push_str(&format!("&timeMin={}", urlencoding::encode(min)));
        }
        if let Some(ref max) = time_max {
            url.push_str(&format!("&timeMax={}", urlencoding::encode(max)));
        }
        url
    };

    let mut res = http_client
        .get(&url_events)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| format!("Events network error: {}", e))?;

    if res.status().as_u16() == 410 {
        let mut fallback_url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events?singleEvents=false&maxResults=2500",
            encoded_cal_id
        );
        if let Some(ref min) = time_min {
            fallback_url.push_str(&format!("&timeMin={}", urlencoding::encode(min)));
        }
        if let Some(ref max) = time_max {
            fallback_url.push_str(&format!("&timeMax={}", urlencoding::encode(max)));
        }
        res = http_client
            .get(&fallback_url)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| format!("Fallback events network error: {}", e))?;
    }

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Google API error for calendar {}: {}", calendar_id, err_text));
    }

    let json_val: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let next_sync_token = json_val
        .get("nextSyncToken")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string());

    let items_array = match json_val.get("items").and_then(|i| i.as_array()) {
        Some(arr) => arr,
        None => return Ok(GoogleEventsFetchResponse { events: vec![], next_sync_token }),
    };

    let mut events = Vec::new();

    for item in items_array {
        let status = item.get("status").and_then(|s| s.as_str()).unwrap_or("confirmed");

        let google_event_id = match item.get("id").and_then(|i| i.as_str()) {
            Some(id) => id.to_string(),
            None => continue,
        };

        let summary = item.get("summary").and_then(|s| s.as_str()).unwrap_or("(No Title)").to_string();
        let description = item.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
        let location = item.get("location").and_then(|l| l.as_str()).map(|s| s.to_string());

        let mut meeting_url: Option<String> = None;
        let mut conferencing_provider = "google_meet".to_string();

        if let Some(hangout) = item.get("hangoutLink").and_then(|h| h.as_str()) {
            meeting_url = Some(hangout.to_string());
            conferencing_provider = "google_meet".to_string();
        } else if let Some(conf_data) = item.get("conferenceData") {
            if let Some(entry_points) = conf_data.get("entryPoints").and_then(|e| e.as_array()) {
                for ep in entry_points {
                    if ep.get("entryPointType").and_then(|t| t.as_str()) == Some("video") {
                        if let Some(uri) = ep.get("uri").and_then(|u| u.as_str()) {
                            meeting_url = Some(uri.to_string());
                            if uri.contains("zoom.us") {
                                conferencing_provider = "zoom".to_string();
                            }
                            break;
                        }
                    }
                }
            }
        }

        let recurring_event_id = item.get("recurringEventId").and_then(|r| r.as_str()).map(|s| s.to_string());
        let original_start_time = item.get("originalStartTime").and_then(|orig| {
            orig.get("dateTime").or_else(|| orig.get("date")).and_then(|d| d.as_str()).map(|s| s.to_string())
        });

        let mut rrule: Option<String> = None;
        if let Some(rec_arr) = item.get("recurrence").and_then(|r| r.as_array()) {
            for r in rec_arr {
                if let Some(r_str) = r.as_str() {
                    if r_str.starts_with("RRULE:") || r_str.starts_with("FREQ=") {
                        rrule = Some(r_str.to_string());
                        break;
                    }
                }
            }
        }

        let color_override = item.get("colorId").and_then(|c| c.as_str()).map(|s| s.to_string());
        let transparency = item.get("transparency").and_then(|t| t.as_str());
        let busy_status = if transparency == Some("transparent") { "free".to_string() } else { "busy".to_string() };

        let mut participants = Vec::new();
        if let Some(attendees) = item.get("attendees").and_then(|a| a.as_array()) {
            for att in attendees {
                if let Some(email) = att.get("email").and_then(|e| e.as_str()) {
                    participants.push(email.to_string());
                } else if let Some(name) = att.get("displayName").and_then(|n| n.as_str()) {
                    participants.push(name.to_string());
                }
            }
        }

        let mut reminders = Vec::new();
        if let Some(rem_obj) = item.get("reminders") {
            if let Some(overrides) = rem_obj.get("overrides").and_then(|o| o.as_array()) {
                for ov in overrides {
                    if let Some(mins) = ov.get("minutes").and_then(|m| m.as_u64()) {
                        reminders.push(format!("{}m", mins));
                    }
                }
            }
        }
        if reminders.is_empty() {
            reminders.push("15m".to_string());
        }

        let start_obj = item.get("start");
        let (start_time, is_all_day, tz) = if let Some(st) = start_obj {
            let tz = st.get("timeZone").and_then(|t| t.as_str()).unwrap_or("UTC").to_string();
            if let Some(dt) = st.get("dateTime").and_then(|d| d.as_str()) {
                (dt.to_string(), false, tz)
            } else if let Some(d) = st.get("date").and_then(|d| d.as_str()) {
                (format!("{}T00:00:00", d), true, tz)
            } else {
                ("1970-01-01T00:00:00".to_string(), false, "UTC".to_string())
            }
        } else {
            ("1970-01-01T00:00:00".to_string(), false, "UTC".to_string())
        };

        let end_obj = item.get("end");
        let end_time = if let Some(et) = end_obj {
            if let Some(dt) = et.get("dateTime").and_then(|d| d.as_str()) {
                dt.to_string()
            } else if let Some(d) = et.get("date").and_then(|d| d.as_str()) {
                format!("{}T00:00:00", d)
            } else {
                start_time.clone()
            }
        } else {
            start_time.clone()
        };

        events.push(NormalizedGoogleEvent {
            google_event_id,
            recurring_event_id,
            original_start_time,
            rrule,
            title: summary,
            description,
            location,
            meeting_url,
            conferencing_provider: Some(conferencing_provider),
            start_time,
            end_time,
            is_all_day,
            time_zone: tz,
            status: status.to_string(),
            busy_status,
            color_override,
            etag: item.get("etag").and_then(|e| e.as_str()).map(|s| s.to_string()),
            participants,
            reminders,
        });
    }

    Ok(GoogleEventsFetchResponse { events, next_sync_token })
}

#[tauri::command]
pub async fn sync_google_calendar(
    access_token: String,
) -> Result<(Vec<GoogleCalendarItem>, Vec<NormalizedGoogleEvent>), String> {
    let calendars = fetch_google_calendars(access_token.clone()).await?;
    let mut all_events = Vec::new();

    for cal in &calendars {
        match fetch_google_events(access_token.clone(), cal.id.clone(), None, None, None).await {
            Ok(res) => {
                all_events.extend(res.events);
            }
            Err(e) => {
                eprintln!("Warning: Failed to fetch events for calendar {}: {}", cal.id, e);
            }
        }
    }

    Ok((calendars, all_events))
}

fn compute_all_day_end(start_date: &str, raw_end_date: &str) -> String {
    if raw_end_date > start_date {
        raw_end_date.to_string()
    } else {
        let parts: Vec<&str> = start_date.split('-').collect();
        if parts.len() == 3 {
            if let (Ok(y), Ok(m), Ok(d)) = (parts[0].parse::<i32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>()) {
                let days_in_month = match m {
                    1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
                    4 | 6 | 9 | 11 => 30,
                    2 => if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 29 } else { 28 },
                    _ => 30,
                };
                if d < days_in_month {
                    format!("{:04}-{:02}-{:02}", y, m, d + 1)
                } else if m < 12 {
                    format!("{:04}-{:02}-01", y, m + 1)
                } else {
                    format!("{:04}-01-01", y + 1)
                }
            } else {
                raw_end_date.to_string()
            }
        } else {
            raw_end_date.to_string()
        }
    }
}

fn sanitize_iana_tz(tz: &str) -> String {
    let lower = tz.to_lowercase();
    if lower.contains("colombo") || lower.contains("kolkata") || lower.contains("india") {
        "Asia/Colombo".to_string()
    } else if lower.contains("karachi") || lower.contains("pakistan") {
        "Asia/Karachi".to_string()
    } else if lower.contains("london") {
        "Europe/London".to_string()
    } else if lower.contains("berlin") {
        "Europe/Berlin".to_string()
    } else if lower.contains("new_york") || lower.contains("new york") {
        "America/New_York".to_string()
    } else if lower.contains("los_angeles") || lower.contains("los angeles") {
        "America/Los_Angeles".to_string()
    } else if lower.contains("singapore") {
        "Asia/Singapore".to_string()
    } else if lower.contains("tokyo") {
        "Asia/Tokyo".to_string()
    } else if lower.contains('/') {
        tz.to_string()
    } else {
        "UTC".to_string()
    }
}

fn format_rfc3339_datetime(dt_str: &str) -> String {
    if dt_str.ends_with('Z') || dt_str.contains('+') || (dt_str.len() > 19 && dt_str[19..].contains('-')) {
        dt_str.to_string()
    } else if dt_str.contains('T') {
        format!("{}Z", dt_str)
    } else {
        format!("{}T00:00:00Z", dt_str)
    }
}

#[tauri::command]
pub async fn create_google_event(
    access_token: String,
    calendar_id: String,
    event: GoogleEventMutationPayload,
) -> Result<NormalizedGoogleEvent, String> {
    let http_client = reqwest::Client::new();
    let encoded_cal_id = urlencoding::encode(&calendar_id);
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events?conferenceDataVersion=1",
        encoded_cal_id
    );

    let mut body = serde_json::json!({
        "summary": event.title,
        "description": event.description.unwrap_or_default(),
        "location": event.location.unwrap_or_default(),
    });

    let tz = sanitize_iana_tz(&event.time_zone.unwrap_or_else(|| "UTC".to_string()));

    if event.is_all_day {
        let start_date = event.start_time.split('T').next().unwrap_or(&event.start_time);
        let raw_end_date = event.end_time.split('T').next().unwrap_or(&event.end_time);
        let exclusive_end_date = compute_all_day_end(start_date, raw_end_date);

        body["start"] = serde_json::json!({ "date": start_date });
        body["end"] = serde_json::json!({ "date": exclusive_end_date });
    } else {
        let start_iso = format_rfc3339_datetime(&event.start_time);
        let end_iso = format_rfc3339_datetime(&event.end_time);
        body["start"] = serde_json::json!({ "dateTime": start_iso, "timeZone": tz });
        body["end"] = serde_json::json!({ "dateTime": end_iso, "timeZone": tz });
    }

    if let Some(rrule_str) = event.rrule {
        if !rrule_str.is_empty() && rrule_str != "none" {
            let formatted_rrule = if rrule_str.starts_with("RRULE:") {
                rrule_str
            } else {
                format!("RRULE:{}", rrule_str)
            };
            body["recurrence"] = serde_json::json!([formatted_rrule]);
        }
    }

    // Only attach originalStartTime if recurringEventId is valid
    if let Some(ref rec_id) = event.recurring_event_id {
        if !rec_id.is_empty() {
            body["recurringEventId"] = serde_json::json!(rec_id);
            if let Some(ref orig_time) = event.original_start_time {
                if !orig_time.is_empty() {
                    if event.is_all_day {
                        let orig_date = orig_time.split('T').next().unwrap_or(orig_time);
                        body["originalStartTime"] = serde_json::json!({ "date": orig_date });
                    } else {
                        let formatted_orig = format_rfc3339_datetime(orig_time);
                        body["originalStartTime"] = serde_json::json!({ "dateTime": formatted_orig, "timeZone": tz });
                    }
                }
            }
        }
    }

    let res = http_client
        .post(&url)
        .bearer_auth(&access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error creating event on Google: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Google API error creating event: {}", err_text));
    }

    let item: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google creation response: {}", e))?;

    let google_event_id = item.get("id").and_then(|i| i.as_str()).unwrap_or_default().to_string();
    let summary = item.get("summary").and_then(|s| s.as_str()).unwrap_or("(No Title)").to_string();
    let description = item.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
    let location = item.get("location").and_then(|l| l.as_str()).map(|s| s.to_string());
    let meeting_url = item.get("hangoutLink").or_else(|| item.get("htmlLink")).and_then(|h| h.as_str()).map(|s| s.to_string());

    Ok(NormalizedGoogleEvent {
        google_event_id,
        recurring_event_id: event.recurring_event_id,
        original_start_time: event.original_start_time,
        rrule: None,
        title: summary,
        description,
        location,
        meeting_url,
        conferencing_provider: Some("google_meet".to_string()),
        start_time: event.start_time,
        end_time: event.end_time,
        is_all_day: event.is_all_day,
        time_zone: tz,
        status: "confirmed".to_string(),
        busy_status: "busy".to_string(),
        color_override: None,
        etag: item.get("etag").and_then(|e| e.as_str()).map(|s| s.to_string()),
        participants: vec![],
        reminders: vec!["15m".to_string()],
    })
}

#[tauri::command]
pub async fn update_google_event(
    access_token: String,
    calendar_id: String,
    event_id: String,
    event: GoogleEventMutationPayload,
) -> Result<NormalizedGoogleEvent, String> {
    let http_client = reqwest::Client::new();
    let encoded_cal_id = urlencoding::encode(&calendar_id);
    let encoded_evt_id = urlencoding::encode(&event_id);
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}",
        encoded_cal_id,
        encoded_evt_id
    );

    let mut body = serde_json::json!({
        "summary": event.title,
        "description": event.description.unwrap_or_default(),
        "location": event.location.unwrap_or_default(),
    });

    let tz = sanitize_iana_tz(&event.time_zone.unwrap_or_else(|| "UTC".to_string()));

    if event.is_all_day {
        let start_date = event.start_time.split('T').next().unwrap_or(&event.start_time);
        let raw_end_date = event.end_time.split('T').next().unwrap_or(&event.end_time);
        let exclusive_end_date = compute_all_day_end(start_date, raw_end_date);

        body["start"] = serde_json::json!({ "date": start_date });
        body["end"] = serde_json::json!({ "date": exclusive_end_date });
    } else {
        let start_iso = format_rfc3339_datetime(&event.start_time);
        let end_iso = format_rfc3339_datetime(&event.end_time);
        body["start"] = serde_json::json!({ "dateTime": start_iso, "timeZone": tz });
        body["end"] = serde_json::json!({ "dateTime": end_iso, "timeZone": tz });
    }

    if let Some(rrule_str) = event.rrule {
        if !rrule_str.is_empty() && rrule_str != "none" {
            let formatted_rrule = if rrule_str.starts_with("RRULE:") {
                rrule_str
            } else {
                format!("RRULE:{}", rrule_str)
            };
            body["recurrence"] = serde_json::json!([formatted_rrule]);
        }
    }

    // Only attach originalStartTime if recurringEventId is valid
    if let Some(ref rec_id) = event.recurring_event_id {
        if !rec_id.is_empty() {
            body["recurringEventId"] = serde_json::json!(rec_id);
            if let Some(ref orig_time) = event.original_start_time {
                if !orig_time.is_empty() {
                    if event.is_all_day {
                        let orig_date = orig_time.split('T').next().unwrap_or(orig_time);
                        body["originalStartTime"] = serde_json::json!({ "date": orig_date });
                    } else {
                        let formatted_orig = format_rfc3339_datetime(orig_time);
                        body["originalStartTime"] = serde_json::json!({ "dateTime": formatted_orig, "timeZone": tz });
                    }
                }
            }
        }
    }

    // Use PUT to completely replace start/end boundaries without field merging conflicts
    let res = http_client
        .put(&url)
        .bearer_auth(&access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error updating event on Google: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Google API error updating event: {}", err_text));
    }

    let item: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google update response: {}", e))?;

    let google_event_id = item.get("id").and_then(|i| i.as_str()).unwrap_or(&event_id).to_string();
    let summary = item.get("summary").and_then(|s| s.as_str()).unwrap_or("(No Title)").to_string();
    let description = item.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
    let location = item.get("location").and_then(|l| l.as_str()).map(|s| s.to_string());
    let meeting_url = item.get("hangoutLink").or_else(|| item.get("htmlLink")).and_then(|h| h.as_str()).map(|s| s.to_string());

    Ok(NormalizedGoogleEvent {
        google_event_id,
        recurring_event_id: event.recurring_event_id,
        original_start_time: event.original_start_time,
        rrule: None,
        title: summary,
        description,
        location,
        meeting_url,
        conferencing_provider: Some("google_meet".to_string()),
        start_time: event.start_time,
        end_time: event.end_time,
        is_all_day: event.is_all_day,
        time_zone: tz,
        status: "confirmed".to_string(),
        busy_status: "busy".to_string(),
        color_override: None,
        etag: item.get("etag").and_then(|e| e.as_str()).map(|s| s.to_string()),
        participants: vec![],
        reminders: vec!["15m".to_string()],
    })
}

#[tauri::command]
pub async fn delete_google_event(
    access_token: String,
    calendar_id: String,
    event_id: String,
) -> Result<(), String> {
    let http_client = reqwest::Client::new();
    let encoded_cal_id = urlencoding::encode(&calendar_id);
    let encoded_evt_id = urlencoding::encode(&event_id);
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}",
        encoded_cal_id,
        encoded_evt_id
    );

    let res = http_client
        .delete(&url)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| format!("Network error deleting event on Google: {}", e))?;

    if res.status().is_success() || res.status().as_u16() == 404 || res.status().as_u16() == 410 {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Google API error deleting event: {}", err_text))
    }
}