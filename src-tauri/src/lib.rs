use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
async fn connect_google_account() -> Result<String, String> {
    Ok("amilavaz2003@gmail.com".to_string())
}

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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kairo.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Kairo calendar application");
}