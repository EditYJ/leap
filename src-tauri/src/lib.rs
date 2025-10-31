use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt as _, Modifiers, Shortcut, ShortcutState,
};

mod apps;
mod image_compress;
mod pdf_generator;

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
async fn compress_image(
    path: String, 
    max_size_kb: u32,
    app: AppHandle,
    image_id: String
) -> Result<image_compress::CompressResult, String> {
    // 在单独的线程中执行压缩,避免阻塞主线程
    tokio::task::spawn_blocking(move || {
        image_compress::compress_image(&path, max_size_kb, |progress| {
            // 发送进度事件到前端
            let _ = app.emit(&format!("compress-progress-{}", image_id), progress);
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
fn get_cpu_count() -> usize {
    num_cpus::get()
}

#[tauri::command]
async fn save_compressed_image(data: String, path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        image_compress::save_compressed_image(&data, &path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn save_temp_image(data: String, filename: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        image_compress::save_temp_image(&data, &filename)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn read_file_as_base64(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        image_compress::read_file_as_base64(&path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        image_compress::get_file_size(&path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn save_images_as_zip(images: Vec<image_compress::ImageData>, path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        image_compress::save_images_as_zip(images, &path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn generate_pdf(text: String, image_paths: Vec<String>, output_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        pdf_generator::generate_pdf(&text, image_paths, &output_path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
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
        .plugin(tauri_plugin_dialog::init())
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
            launch_app,
            compress_image,
            save_compressed_image,
            save_temp_image,
            read_file_as_base64,
            get_file_size,
            save_images_as_zip,
            get_cpu_count,
            generate_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
