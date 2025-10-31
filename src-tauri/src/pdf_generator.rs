use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;

// A4纸张尺寸 (毫米)
const A4_WIDTH_MM: f32 = 210.0;
const A4_HEIGHT_MM: f32 = 297.0;

// 边距 (毫米)
const MARGIN_MM: f32 = 10.0;

// 文本大小 (点)
const FONT_SIZE: f32 = 12.0;
const LINE_HEIGHT_MM: f32 = 5.0; // 行高(毫米)

pub fn generate_pdf(text: &str, image_paths: Vec<String>, output_path: &str) -> Result<(), String> {
    // 创建PDF文档
    let (doc, page1, layer1) = PdfDocument::new(
        "Generated PDF",
        Mm(A4_WIDTH_MM),
        Mm(A4_HEIGHT_MM),
        "Layer 1",
    );

    // 如果有文本,在第一页添加文本
    if !text.is_empty() {
        let current_layer = doc.get_page(page1).get_layer(layer1);
        add_text_to_page(&doc, &current_layer, text)?;
    }

    // 添加图片
    for (index, image_path) in image_paths.iter().enumerate() {
        // 每张图片一个新页面
        let (page_index, layer_index) = if index == 0 && text.is_empty() {
            (page1, layer1)
        } else {
            doc.add_page(Mm(A4_WIDTH_MM), Mm(A4_HEIGHT_MM), "Layer 1")
        };

        let current_layer = doc.get_page(page_index).get_layer(layer_index);
        add_image_to_page(&current_layer, image_path)?;
    }

    // 保存PDF
    doc.save(&mut BufWriter::new(
        File::create(output_path).map_err(|e| format!("Failed to create PDF file: {}", e))?,
    ))
    .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(())
}

fn add_text_to_page(
    doc: &PdfDocumentReference,
    layer: &PdfLayerReference,
    text: &str,
) -> Result<(), String> {
    // 获取字体文件路径 (在编译后的可执行文件旁边的assets目录)
    let font_path = if cfg!(debug_assertions) {
        // 开发模式：使用src-tauri/assets下的字体
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/AlibabaPuHuiTi-3-65-Medium.ttf")
    } else {
        // 生产模式：使用可执行文件旁边的assets目录
        std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("Failed to get parent directory")?
            .join("assets/AlibabaPuHuiTi-3-65-Medium.ttf")
    };

    // 读取字体文件
    let font_data = std::fs::read(&font_path)
        .map_err(|e| format!("Failed to read font file {:?}: {}", font_path, e))?;

    // 加载外部字体 (使用Cursor包装字节数据)
    let font = doc
        .add_external_font(std::io::Cursor::new(font_data))
        .map_err(|e| format!("Failed to load font: {}", e))?;

    // 起始位置 (从页面顶部开始)
    let mut y_position = A4_HEIGHT_MM - MARGIN_MM;

    // 分行处理文本
    for line in text.lines() {
        if y_position < MARGIN_MM {
            break;
        }

        // 使用中文字体渲染文本
        layer.use_text(
            line,
            FONT_SIZE,
            Mm(MARGIN_MM),
            Mm(y_position),
            &font,
        );

        y_position -= LINE_HEIGHT_MM;
    }

    Ok(())
}

fn add_image_to_page(
    layer: &PdfLayerReference,
    image_path: &str,
) -> Result<(), String> {
    // 读取图片
    let img = ::image::open(image_path)
        .map_err(|e| format!("Failed to open image {}: {}", image_path, e))?;

    // 转换为RGB
    let rgb_image = img.to_rgb8();
    let (img_width, img_height) = rgb_image.dimensions();

    // 图片宽度撑满A4纸宽度
    let target_width_mm = A4_WIDTH_MM;

    // 计算图片的宽高比
    let aspect_ratio = img_width as f32 / img_height as f32;

    // 根据宽度计算高度
    let target_height_mm = target_width_mm / aspect_ratio;

    // 检查图片是否超出页面高度
    let (final_width_mm, final_height_mm) = if target_height_mm > A4_HEIGHT_MM {
        // 如果高度超出,按高度缩放
        (A4_HEIGHT_MM * aspect_ratio, A4_HEIGHT_MM)
    } else {
        (target_width_mm, target_height_mm)
    };

    // 图片放在页面左上角 (0, 从顶部计算的位置)
    let x_position_mm = 0.0;
    let y_position_mm = A4_HEIGHT_MM - final_height_mm;

    // 从RGB图片创建图片对象
    let image_data = rgb_image.into_raw();

    let image_pdf = Image::from(ImageXObject {
        width: Px(img_width as usize),
        height: Px(img_height as usize),
        color_space: ColorSpace::Rgb,
        bits_per_component: ColorBits::Bit8,
        interpolate: true,
        image_data,
        image_filter: None,
        clipping_bbox: None,
        smask: None,
    });

    // 计算DPI：我们希望图片宽度为final_width_mm毫米
    // 公式：dpi = (pixels * 25.4) / mm
    let dpi_x = (img_width as f32 * 25.4) / final_width_mm;
    let dpi_y = (img_height as f32 * 25.4) / final_height_mm;
    
    // 使用平均DPI
    let dpi = (dpi_x + dpi_y) / 2.0;

    // 添加图片到页面
    image_pdf.add_to_layer(
        layer.clone(),
        ImageTransform {
            translate_x: Some(Mm(x_position_mm)),
            translate_y: Some(Mm(y_position_mm)),
            scale_x: Some(1.0),
            scale_y: Some(1.0),
            rotate: None,
            dpi: Some(dpi),
        },
    );

    Ok(())
}
