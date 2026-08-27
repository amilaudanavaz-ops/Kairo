mod google;
mod tray;
mod scheduler;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

// --- NEW COMMANDS ---
#[tauri::command]
fn show_main_window(window: tauri::Window) {
    if let Some(main) = window.get_webview_window("main") {
        main.unminimize().unwrap_or(());
        main.show().unwrap_or(());
        main.set_focus().unwrap_or(());
    }
}

#[tauri::command]
fn schedule_next_notification(
    payload: Option<serde_json::Value>,
    time_ms: Option<i64>,
    app: tauri::AppHandle,
) {
    // try_state safely checks if the thread is ready without crashing the app!
    if let Some(state) = app.try_state::<scheduler::SchedulerState>() {
        let target = match (payload, time_ms) {
            (Some(p), Some(m)) => Some((p, m)),
            _ => None,
        };
        let _ = state.sync_sender.send(target);
    }
}

#[tauri::command]
fn hide_notification_window(app: tauri::AppHandle) {
    // A bulletproof backend command to guarantee the window closes when Dismiss is clicked
    if let Some(window) = app.get_webview_window("notification") {
        window.hide().unwrap_or(());
    }
}

// Keep the old command as a safe no-op
#[tauri::command]
fn sync_reminders() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "001_initial_schema",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .setup(|app| {
            // Initialize tray icon
            tray::create_tray(app.handle())?;
            // Start the 0% CPU background notification thread
            scheduler::start_background_scheduler(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // OS-Level Focus Tracker: Instantly hide tray when you click away!
            tauri::WindowEvent::Focused(is_focused) => {
                if !is_focused && window.label() == "tray" {
                    let now = chrono::Utc::now().timestamp_millis();
                    let last_show = crate::tray::LAST_TRAY_SHOW.load(std::sync::atomic::Ordering::Relaxed);
                    
                    // GRACE PERIOD: If the window was opened less than 200ms ago, 
                    // it means the taskbar is just stealing focus during the mouse-click release. Ignore it!
                    if now - last_show > 200 {
                        window.hide().unwrap_or(());
                        crate::tray::LAST_TRAY_HIDE.store(now, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            }
            // Override close button to hide to tray instead of quitting
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kairo.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            google::start_google_auth,
            google::refresh_google_token,
            google::fetch_google_calendars,
            google::fetch_google_events,
            google::sync_google_calendar,
            google::create_google_event,
            google::update_google_event,
            google::delete_google_event,
            show_main_window,
            sync_reminders,
            schedule_next_notification,
            hide_notification_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kairo calendar application");
}