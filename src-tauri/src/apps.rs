use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use sha2::{Sha256, Digest};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
}

// 获取图标缓存目录
fn get_icon_cache_dir() -> Option<PathBuf> {
    dirs::cache_dir().map(|cache| cache.join("leap").join("icons"))
}

// 为路径生成唯一的缓存键
fn get_cache_key(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    format!("{:x}", hasher.finalize())
}

// 从缓存读取图标
fn read_icon_from_cache(path: &str) -> Option<String> {
    let cache_dir = get_icon_cache_dir()?;
    let cache_key = get_cache_key(path);
    let cache_file = cache_dir.join(format!("{}.txt", cache_key));
    
    if cache_file.exists() {
        std::fs::read_to_string(cache_file).ok()
    } else {
        None
    }
}

// 保存图标到缓存
fn save_icon_to_cache(path: &str, icon_data: &str) -> Result<(), std::io::Error> {
    let cache_dir = get_icon_cache_dir().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "Cache directory not found")
    })?;
    
    std::fs::create_dir_all(&cache_dir)?;
    
    let cache_key = get_cache_key(path);
    let cache_file = cache_dir.join(format!("{}.txt", cache_key));
    
    std::fs::write(cache_file, icon_data)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn extract_icon_as_base64(exe_path: &str) -> Option<String> {
    use base64::{engine::general_purpose, Engine as _};
    use image::{ImageBuffer, RgbaImage, ImageEncoder};
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::shellapi::ExtractIconW;
    use winapi::um::winuser::{GetIconInfo, DestroyIcon, GetDC, ReleaseDC};
    use winapi::um::wingdi::{GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS};

    // 先检查缓存
    if let Some(cached_icon) = read_icon_from_cache(exe_path) {
        return Some(cached_icon);
    }

    unsafe {
        let cleaned_path = exe_path.trim_matches('"');
        let path_wide: Vec<u16> = OsStr::new(cleaned_path)
            .encode_wide()
            .chain(Some(0))
            .collect();

        // 提取第一个图标
        let hicon = ExtractIconW(std::ptr::null_mut(), path_wide.as_ptr(), 0);
        
        if hicon.is_null() || hicon as usize <= 1 {
            return None;
        }

        // 获取图标信息
        let mut icon_info = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            DestroyIcon(hicon);
            return None;
        }

        // 获取设备上下文
        let hdc = GetDC(std::ptr::null_mut());
        
        // 设置位图信息
        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = 32;
        bmi.bmiHeader.biHeight = -32; // 负值表示自上而下
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        // 分配像素缓冲区
        let buffer_size = 32 * 32 * 4;
        let mut buffer: Vec<u8> = vec![0; buffer_size];

        // 获取位图数据
        let result = GetDIBits(
            hdc,
            icon_info.hbmColor,
            0,
            32,
            buffer.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        ReleaseDC(std::ptr::null_mut(), hdc);
        DestroyIcon(hicon);

        if result == 0 {
            return None;
        }

        // 转换 BGRA 到 RGBA 并创建图像
        let mut img: RgbaImage = ImageBuffer::new(32, 32);
        for y in 0..32u32 {
            for x in 0..32u32 {
                let idx = ((y * 32 + x) * 4) as usize;
                if idx + 3 < buffer.len() {
                    let b = buffer[idx];
                    let g = buffer[idx + 1];
                    let r = buffer[idx + 2];
                    let a = buffer[idx + 3];
                    img.put_pixel(x, y, image::Rgba([r, g, b, a]));
                }
            }
        }

        // 编码为 PNG
        let mut png_data = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
        if encoder.write_image(img.as_raw(), 32, 32, image::ExtendedColorType::Rgba8).is_ok() {
            let base64_str = general_purpose::STANDARD.encode(&png_data);
            let data_url = format!("data:image/png;base64,{}", base64_str);
            
            // 保存到缓存
            let _ = save_icon_to_cache(exe_path, &data_url);
            
            return Some(data_url);
        }

        None
    }
}

#[cfg(not(target_os = "windows"))]
fn extract_icon_as_base64(_exe_path: &str) -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
pub fn get_installed_apps() -> Vec<AppInfo> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut apps = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    // 1. 从注册表获取已安装的应用
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let uninstall_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];

    for path in &uninstall_paths {
        if let Ok(uninstall) = hklm.open_subkey(path) {
            for key_name in uninstall.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(app_key) = uninstall.open_subkey(&key_name) {
                    let display_name: Result<String, _> = app_key.get_value("DisplayName");
                    let display_icon: Result<String, _> = app_key.get_value("DisplayIcon");

                    if let Ok(name) = display_name {
                        let name_lower = name.to_lowercase();
                        
                        // 过滤系统组件、更新、卸载器等
                        if name.len() < 2
                            || name_lower.contains("uninstall")
                            || name_lower.contains("uninst")
                            || name_lower.contains("update")
                            || name_lower.contains("redistributable")
                            || name_lower.contains("runtime")
                            || name_lower.contains("redist")
                            || name_lower.starts_with("microsoft visual c++")
                            || name_lower.starts_with("microsoft .net")
                            || name_lower.contains("setup")
                            || name_lower.contains("installer")
                        {
                            continue;
                        }

                        // 尝试获取可执行文件路径
                        let exe_path = if let Ok(icon_path) = display_icon {
                            // DisplayIcon 通常包含 exe 路径
                            let path = icon_path.split(',').next().unwrap_or("").trim().to_string();
                            // 再次检查路径中是否包含卸载器标识
                            let path_lower = path.to_lowercase();
                            if path_lower.contains("uninstall") || path_lower.contains("uninst") {
                                String::new()
                            } else {
                                path
                            }
                        } else {
                            String::new()
                        };

                        if !exe_path.is_empty() && !seen_names.contains(&name) {
                            seen_names.insert(name.clone());
                            
                            // 提取应用图标 (带缓存)
                            let icon = extract_icon_as_base64(&exe_path);
                            
                            apps.push(AppInfo {
                                name: name.clone(),
                                path: exe_path,
                                icon,
                            });
                        }
                    }
                }
            }
        }
    }

    // 按名称排序
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    apps
}

#[cfg(target_os = "macos")]
pub fn get_installed_apps() -> Vec<AppInfo> {
    use std::fs;

    let mut apps = Vec::new();
    let app_dirs = vec!["/Applications", "/System/Applications"];

    for dir in app_dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "app" {
                        if let Some(name) = path.file_stem() {
                            apps.push(AppInfo {
                                name: name.to_string_lossy().to_string(),
                                path: path.to_string_lossy().to_string(),
                                icon: None,
                            });
                        }
                    }
                }
            }
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

#[cfg(target_os = "linux")]
pub fn get_installed_apps() -> Vec<AppInfo> {
    use std::fs;

    let mut apps = Vec::new();
    let desktop_dirs = vec![
        "/usr/share/applications",
        "/usr/local/share/applications",
        dirs::data_dir()
            .map(|p| p.join("applications"))
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    ];

    for dir in desktop_dirs {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "desktop" {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let mut name = String::new();
                            let mut exec = String::new();

                            for line in content.lines() {
                                if line.starts_with("Name=") {
                                    name = line[5..].to_string();
                                } else if line.starts_with("Exec=") {
                                    exec = line[5..].to_string();
                                }
                            }

                            if !name.is_empty() && !exec.is_empty() {
                                apps.push(AppInfo {
                                    name,
                                    path: exec,
                                    icon: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

pub fn launch_app(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // 移除路径中可能存在的引号
        let cleaned_path = path.trim_matches('"');

        // 使用 cmd 的 start 命令来启动应用
        Command::new("cmd")
            .args(["/C", "start", "", cleaned_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // 移除 .desktop 文件的参数占位符
        let cleaned_path = path.split_whitespace().next().unwrap_or(path);
        Command::new(cleaned_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
