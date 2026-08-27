// ==========================================
// TRAY MENU BACKEND (src-tauri/src/tray.rs)
// ==========================================

// --- IMPORTS ---
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition, Emitter};
use std::sync::atomic::{AtomicI64, Ordering};
use chrono::Utc;

// Track when the window was last hidden/shown to prevent race conditions
pub static LAST_TRAY_HIDE: AtomicI64 = AtomicI64::new(0);
pub static LAST_TRAY_SHOW: AtomicI64 = AtomicI64::new(0);

// --- TRAY SETUP & INITIALIZATION ---
/// Creates and registers the system tray icon and its event listeners.
pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::new()
        // Use the default app icon (configured in tauri.conf.json)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Kairo Calendar")
        .on_tray_icon_event(|tray, event| {
            // --- EVENT HANDLING ---
            match event {
                TrayIconEvent::Click {
                    button,
                    button_state,
                    position,
                    rect,
                    ..
                } => {
                    // --- THE CULPRIT: DOUBLE FIRE PREVENTION ---
                    // A physical mouse click sends TWO events to Tauri: "Down" and "Up".
                    // If we don't ignore one of them, the window opens on press and instantly closes on release!
                    if button_state == MouseButtonState::Down {
                        return;
                    }

                    let app_handle = tray.app_handle();
                    
                    match button {
                        // --- LEFT CLICK: Show Custom Svelte Tray Panel ---
                        MouseButton::Left => {
                            if let Some(tray_window) = app_handle.get_webview_window("tray") {
                                let now = Utc::now().timestamp_millis();
                                let last_hide = LAST_TRAY_HIDE.load(Ordering::Relaxed);
                                
                                // If hidden less than 200ms ago, user is trying to close it. Abort opening!
                                if now - last_hide < 200 {
                                    return;
                                }

                                // Toggle Logic
                                if tray_window.is_visible().unwrap_or(false) {
                                    tray_window.hide().unwrap_or(());
                                    LAST_TRAY_HIDE.store(now, Ordering::Relaxed);
                                    return;
                                }

                                // 1. Safely extract X/Y from the Position enum
                                let (mut icon_x, mut icon_y) = match rect.position {
                                    tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
                                    tauri::Position::Logical(p) => (p.x, p.y),
                                };

                                // Windows 11 Fallback: If OS returns 0,0 for icon rect
                                if icon_x == 0.0 && icon_y == 0.0 {
                                    icon_x = position.x;
                                    icon_y = position.y;
                                }

                                // 2. Safely extract Width/Height from the Size enum
                                let (mut icon_width, _) = match rect.size {
                                    tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
                                    tauri::Size::Logical(s) => (s.width, s.height),
                                };
                                
                                if icon_width == 0.0 {
                                    icon_width = 30.0; 
                                }

                                // 3. Get actual window size
                                let window_size = tray_window.outer_size().unwrap_or(tauri::PhysicalSize::new(320, 450));
                                
                                // 4. Center X, place Y above taskbar
                                let x = icon_x + (icon_width / 2.0) - (window_size.width as f64 / 2.0);
                                let y = icon_y - (window_size.height as f64) - 8.0;

                                tray_window.set_position(PhysicalPosition::new(x, y)).unwrap_or(());
                                tray_window.show().unwrap_or(());
                                tray_window.set_focus().unwrap_or(());
                                
                                // Record the exact millisecond the window was spawned to prevent focus stealing
                                LAST_TRAY_SHOW.store(Utc::now().timestamp_millis(), Ordering::Relaxed);
                                tray_window.emit("tray_opened", ()).unwrap_or(());
                            }
                        }
                        
                        // --- RIGHT CLICK: Show Main App ---
                        MouseButton::Right => {
                            if let Some(main_window) = app_handle.get_webview_window("main") {
                                main_window.unminimize().unwrap_or(());
                                main_window.show().unwrap_or(());
                                main_window.set_focus().unwrap_or(());
                            }
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}