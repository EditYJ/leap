use base64::{engine::general_purpose, Engine as _};
use image::{ImageFormat, ImageReader, DynamicImage};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::io::Write;
use zip::write::FileOptions;

#[derive(Debug, Serialize, Deserialize)]
pub struct CompressResult {
    pub original_size: u64,
    pub compressed_size: u64,
    pub compressed_data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub name: String,
    pub data: String,
}

pub fn compress_image<F>(path: &str, max_size_kb: u32, mut progress_callback: F) -> Result<CompressResult, String> 
where
    F: FnMut(u8),
{
    println!("开始压缩图片: {}, 目标大小: {}KB", path, max_size_kb);
    progress_callback(0);
    
    // 读取原始文件
    let original_data = fs::read(path).map_err(|e| format!("Failed to read image: {}", e))?;
    let original_size = original_data.len() as u64;
    progress_callback(10);
    
    println!("原始文件大小: {} bytes ({:.2} KB)", original_size, original_size as f64 / 1024.0);

    // 如果原始文件已经小于目标大小,直接返回
    let target_size = (max_size_kb as u64) * 1024;
    if original_size <= target_size {
        println!("文件已经满足目标大小,无需压缩");
        let base64_data = general_purpose::STANDARD.encode(&original_data);
        progress_callback(100);
        return Ok(CompressResult {
            original_size,
            compressed_size: original_size,
            compressed_data: base64_data,
        });
    }

    // 解码图像
    progress_callback(20);
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    progress_callback(30);
    println!("图像尺寸: {}x{}", img.width(), img.height());

    // 获取原始格式
    let format = get_image_format(path)?;
    
    // 尝试压缩
    progress_callback(40);
    let compressed_data = match format {
        ImageFormat::Jpeg => compress_jpeg(&img, target_size, |p| progress_callback(40 + p / 2))?,
        ImageFormat::Png => compress_png(&img, target_size, |p| progress_callback(40 + p / 2))?,
        _ => {
            // 其他格式转为 JPEG 压缩
            println!("不支持的格式,转为 JPEG 压缩");
            compress_jpeg(&img, target_size, |p| progress_callback(40 + p / 2))?
        }
    };
    
    progress_callback(90);
    
    progress_callback(90);
    
    // 如果压缩后反而更大,使用原始数据
    let compressed_size = compressed_data.len() as u64;
    let final_data = if compressed_size > original_size {
        println!("压缩后更大 ({:.2} KB > {:.2} KB),使用原始数据", 
            compressed_size as f64 / 1024.0, 
            original_size as f64 / 1024.0
        );
        original_data
    } else {
        let reduction = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;
        println!("压缩成功: {:.2} KB -> {:.2} KB, 减少 {:.1}%", 
            original_size as f64 / 1024.0,
            compressed_size as f64 / 1024.0,
            reduction
        );
        compressed_data
    };
    
    let final_size = final_data.len() as u64;
    let base64_data = general_purpose::STANDARD.encode(&final_data);
    
    progress_callback(100);
    
    Ok(CompressResult {
        original_size,
        compressed_size: final_size,
        compressed_data: base64_data,
    })
}

fn compress_jpeg<F>(img: &DynamicImage, target_size: u64, mut progress_callback: F) -> Result<Vec<u8>, String>
where
    F: FnMut(u8),
{
    println!("使用 mozjpeg 压缩 JPEG");
    
    let rgb_img = img.to_rgb8();
    let width = rgb_img.width() as usize;
    let height = rgb_img.height() as usize;
    
    // 使用二分查找策略,从中间质量开始尝试
    let qualities = [25, 35, 45, 55, 65, 75, 85];
    let mut left = 0;
    let mut right = qualities.len() - 1;
    let mut best_result: Option<Vec<u8>> = None;
    let mut attempts = 0;
    let max_attempts = 4; // 预计最多尝试次数
    
    progress_callback(0);
    
    // 先尝试中间质量
    while left <= right {
        let mid = (left + right) / 2;
        let quality = qualities[mid];
        
        attempts += 1;
        progress_callback((attempts * 100 / max_attempts).min(90) as u8);
        
        println!("尝试质量: {}", quality);
        
        let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
        comp.set_size(width, height);
        comp.set_quality(quality as f32);
        comp.set_optimize_scans(true);
        
        let mut comp = comp.start_compress(Vec::new())
            .map_err(|e| format!("Failed to start compression: {:?}", e))?;
        
        comp.write_scanlines(rgb_img.as_raw())
            .map_err(|e| format!("Failed to write scanlines: {:?}", e))?;
        
        let compressed_data = comp.finish()
            .map_err(|e| format!("Failed to finish compression: {:?}", e))?;
        
        let size = compressed_data.len() as u64;
        println!("  压缩后: {:.2} KB", size as f64 / 1024.0);
        
        if size <= target_size {
            // 满足目标,尝试更高质量
            println!("  满足目标大小,尝试更高质量");
            best_result = Some(compressed_data);
            if mid == qualities.len() - 1 {
                break;
            }
            left = mid + 1;
        } else {
            // 不满足,尝试更低质量
            println!("  超过目标大小,尝试更低质量");
            if mid == 0 {
                break;
            }
            right = mid - 1;
        }
    }
    
    // 如果找到满足条件的结果,返回它;否则返回最低质量的结果
    progress_callback(100);
    if let Some(result) = best_result {
        println!("  使用满足条件的最高质量结果");
        Ok(result)
    } else {
        println!("  使用最低质量 25");
        let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
        comp.set_size(width, height);
        comp.set_quality(25.0);
        comp.set_optimize_scans(true);
        
        let mut comp = comp.start_compress(Vec::new())
            .map_err(|e| format!("Failed to start compression: {:?}", e))?;
        
        comp.write_scanlines(rgb_img.as_raw())
            .map_err(|e| format!("Failed to write scanlines: {:?}", e))?;
        
        comp.finish()
            .map_err(|e| format!("Failed to finish compression: {:?}", e))
    }
}

fn compress_png<F>(img: &DynamicImage, _target_size: u64, mut progress_callback: F) -> Result<Vec<u8>, String>
where
    F: FnMut(u8),
{
    println!("压缩 PNG (使用量化)");
    progress_callback(0);
    
    let rgba_img = img.to_rgba8();
    let width = rgba_img.width() as usize;
    let height = rgba_img.height() as usize;
    
    progress_callback(20);
    
    // 使用 imagequant 进行颜色量化
    let mut liq = imagequant::new();
    liq.set_speed(5).map_err(|e| format!("Failed to set speed: {:?}", e))?;
    liq.set_quality(0, 100).map_err(|e| format!("Failed to set quality: {:?}", e))?;
    
    progress_callback(40);
    
    // 将图像数据转换为 RGBA 切片
    let rgba_data = rgba_img.as_raw();
    let rgba_pixels: Vec<imagequant::RGBA> = rgba_data
        .chunks_exact(4)
        .map(|chunk| imagequant::RGBA::new(chunk[0], chunk[1], chunk[2], chunk[3]))
        .collect();
    
    progress_callback(50);
    
    let mut img_data = liq.new_image(
        rgba_pixels.into_boxed_slice(),
        width,
        height,
        0.0
    ).map_err(|e| format!("Failed to create image: {:?}", e))?;
    
    progress_callback(60);
    
    let mut res = liq.quantize(&mut img_data)
        .map_err(|e| format!("Failed to quantize: {:?}", e))?;
    
    progress_callback(70);
    
    res.set_dithering_level(1.0)
        .map_err(|e| format!("Failed to set dithering: {:?}", e))?;
    
    let (palette, pixels) = res.remapped(&mut img_data)
        .map_err(|e| format!("Failed to remap: {:?}", e))?;
    
    progress_callback(80);
    
    // 编码为 PNG
    let mut png_data = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, width as u32, height as u32);
        encoder.set_color(png::ColorType::Indexed);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_compression(png::Compression::Best);
        
        let pal: Vec<u8> = palette.iter()
            .flat_map(|c| vec![c.r, c.g, c.b])
            .collect();
        encoder.set_palette(pal);
        
        let mut writer = encoder.write_header()
            .map_err(|e| format!("Failed to write PNG header: {:?}", e))?;
        
        writer.write_image_data(&pixels)
            .map_err(|e| format!("Failed to write PNG data: {:?}", e))?;
    }
    
    let size = png_data.len() as u64;
    println!("  压缩后: {:.2} KB", size as f64 / 1024.0);
    
    progress_callback(100);
    
    Ok(png_data)
}

pub fn save_compressed_image(data: &str, path: &str) -> Result<(), String> {
    let decoded = general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    fs::write(path, decoded).map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

pub fn save_temp_image(data: &str, filename: &str) -> Result<String, String> {
    let decoded = general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("leap_{}", filename));
    
    fs::write(&temp_path, decoded).map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    Ok(temp_path.to_string_lossy().to_string())
}

pub fn read_file_as_base64(path: &str) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(general_purpose::STANDARD.encode(&data))
}

pub fn get_file_size(path: &str) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    Ok(metadata.len())
}

fn get_image_format(path: &str) -> Result<ImageFormat, String> {
    let path = Path::new(path);
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .ok_or("No file extension")?
        .to_lowercase();
    
    match extension.as_str() {
        "jpg" | "jpeg" => Ok(ImageFormat::Jpeg),
        "png" => Ok(ImageFormat::Png),
        "webp" => Ok(ImageFormat::WebP),
        "bmp" => Ok(ImageFormat::Bmp),
        "gif" => Ok(ImageFormat::Gif),
        _ => Err(format!("Unsupported image format: {}", extension)),
    }
}

pub fn save_images_as_zip(images: Vec<ImageData>, path: &str) -> Result<(), String> {
    let file = fs::File::create(path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(6));
    
    for image in images {
        let decoded = general_purpose::STANDARD
            .decode(&image.data)
            .map_err(|e| format!("Failed to decode base64 for {}: {}", image.name, e))?;
        
        zip.start_file(&image.name, options)
            .map_err(|e| format!("Failed to start file {}: {}", image.name, e))?;
        
        zip.write_all(&decoded)
            .map_err(|e| format!("Failed to write file {}: {}", image.name, e))?;
    }
    
    zip.finish()
        .map_err(|e| format!("Failed to finish zip: {}", e))?;
    
    Ok(())
}
