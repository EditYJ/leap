use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt as _, Modifiers, Shortcut, ShortcutState,
};

mod apps;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_installed_apps() -> Vec<apps::AppInfo> {
    apps::get_installed_apps()
}

#[tauri::command]
fn launch_app(path: String) -> Result<(), String> {
    apps::launch_app(&path)
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

#[tauri::command]
async fn animate_window_resize(app: AppHandle, target_width: f64, target_height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        if let (Ok(current_size), Ok(current_position)) =
            (window.outer_size(), window.outer_position())
        {
            let start_width = current_size.width as f64;
            let start_height = current_size.height as f64;
            let start_x = current_position.x as f64;
            let start_y = current_position.y as f64;

            // 获取屏幕尺寸来计算居中位置
            if let Some(monitor) = window.current_monitor().ok().flatten() {
                let screen_size = monitor.size();
                let screen_width = screen_size.width as f64;
                let screen_height = screen_size.height as f64;

                // 计算目标居中位置
                let target_x = (screen_width - target_width) / 2.0;
                let target_y = (screen_height - target_height) / 2.0;

                let steps = 6; // 动画步数
                let duration = 100; // 总时长（毫秒）
                let step_duration = duration / steps;

                for i in 1..=steps {
                    let progress = i as f64 / steps as f64;
                    // 使用缓动函数（ease-out）
                    let eased_progress = 1.0 - (1.0 - progress).powi(3);

                    let new_width = start_width + (target_width - start_width) * eased_progress;
                    let new_height = start_height + (target_height - start_height) * eased_progress;
                    let new_x = start_x + (target_x - start_x) * eased_progress;
                    let new_y = start_y + (target_y - start_y) * eased_progress;

                    let _ = window.set_size(tauri::PhysicalSize::new(
                        new_width as u32,
                        new_height as u32,
                    ));

                    let _ = window
                        .set_position(tauri::PhysicalPosition::new(new_x as i32, new_y as i32));

                    thread::sleep(Duration::from_millis(step_duration as u64));
                }

                // 确保最终尺寸和位置精确
                let _ = window.set_size(tauri::PhysicalSize::new(
                    target_width as u32,
                    target_height as u32,
                ));
                let _ = window.set_position(tauri::PhysicalPosition::new(
                    target_x as i32,
                    target_y as i32,
                ));
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_tray_icon_event(|app, event| match event {
            tauri::tray::TrayIconEvent::DoubleClick { .. } => {
                toggle_window(app.clone());
            }
            _ => {}
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // 监听窗口失去焦点事件
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = window_clone.hide();
                    }
                });
            }

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
        .invoke_handler(tauri::generate_handler![
            greet,
            toggle_window,
            animate_window_resize,
            get_installed_apps,
            launch_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
