// ==========================================
// SCHEDULER BACKEND (src-tauri/src/scheduler.rs)
// ==========================================

use chrono::Utc;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::mpsc;

// --- STATE MANAGEMENT ---
pub struct SchedulerState {
    // Now accepts a rich JSON object from Svelte containing Title, Time, Color, etc.
    pub sync_sender: mpsc::UnboundedSender<Option<(serde_json::Value, i64)>>,
}

// --- CORE SCHEDULER ENGINE ---
pub fn start_background_scheduler(app: AppHandle) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Option<(serde_json::Value, i64)>>();
    app.manage(SchedulerState { sync_sender: tx });

    tauri::async_runtime::spawn(async move {
        let mut current_target: Option<(serde_json::Value, i64)> = None;
        
        loop {
            match current_target.clone() {
                Some((payload, time_ms)) => {
                    let now = Utc::now().timestamp_millis();
                    
                    if time_ms > now {
                        let duration = Duration::from_millis((time_ms - now) as u64);
                        
                        tokio::select! {
                            // Branch A: The exact time has arrived
                            _ = tokio::time::sleep(duration) => {
                                fire_notification(&app, &payload);
                                current_target = None;
                                // Ask Svelte to calculate the next reminder
                                app.emit("request_next_reminder", ()).unwrap_or(());
                            }
                            // Branch B: Svelte found a newer/earlier reminder
                            new_target = rx.recv() => {
                                if let Some(target) = new_target {
                                    current_target = target;
                                }
                            }
                        }
                    } else {
                        // Target time already passed, drop it and ask for next
                        current_target = None;
                        app.emit("request_next_reminder", ()).unwrap_or(());
                    }
                }
                None => {
                    // IDLE: Sleep forever until Svelte sends us a target
                    if let Some(new_target) = rx.recv().await {
                        current_target = new_target;
                    }
                }
            }
        }
    });
}

// --- HELPER FUNCTIONS ---
fn fire_notification(app: &AppHandle, payload: &serde_json::Value) {
    // 1. Instantly tell the Main Window to play the sound right on the millisecond!
    app.emit("play_chime", ()).unwrap_or(());

    // 2. Position and wake up the Notification Window
    if let Some(window) = app.get_webview_window("notification") {
        if let Ok(Some(monitor)) = window.current_monitor() {
            let monitor_size = monitor.size();
            let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(320, 100));
            
            // 20px padding from the right, 60px padding from bottom
            let x = monitor_size.width.saturating_sub(window_size.width + 20);
            let y = monitor_size.height.saturating_sub(window_size.height + 60);
            
            window.set_position(tauri::PhysicalPosition::new(x, y)).unwrap_or(());
        }

        window.show().unwrap_or(());
        window.unminimize().unwrap_or(());
        window.set_always_on_top(true).unwrap_or(());
        window.set_focus().unwrap_or(());

        // 3. WAKE-UP DELAY
        // Webviews pause their JS engines when hidden. We wait exactly 300ms for it to un-pause
        // before throwing the text payload at it, guaranteeing it catches the data!
        let w_clone = window.clone();
        let p_clone = payload.clone();
        
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            w_clone.emit("show_reminder", p_clone).unwrap_or(());
        });
    }
}