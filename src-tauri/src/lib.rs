use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt as _, Modifiers, Shortcut, ShortcutState,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn toggle_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_tray_icon_event(|app, event| match event {
            tauri::tray::TrayIconEvent::DoubleClick {
                id,
                position,
                rect,
                button,
            } => {
                toggle_window(app.clone());
            }
            _ => {}
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
            app.global_shortcut()
                .on_shortcut(shortcut, move |handler, _shortcut, event| {
                    match event.state() {
                        ShortcutState::Released => {
                            toggle_window(handler.clone());
                        }
                        _ => {}
                    }
                })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, toggle_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
