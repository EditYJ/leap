import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { save } from '@tauri-apps/plugin-dialog'
import { Upload, Download, X, ImageIcon, Loader2, Package } from 'lucide-react'
import { ToolLayout } from '@/components/layouts/ToolLayout'

interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  originalPath: string
  compressedData: string
  previewUrl?: string // 用于显示原始图片预览
  status: 'pending' | 'processing' | 'success' | 'error' | 'loading'
  progress: number
  error?: string
}

export function ImageCompressor() {
  const [images, setImages] = useState<CompressedImage[]>([])
  const [maxSizeKB, setMaxSizeKB] = useState<number>(500)
  const [isProcessing, setIsProcessing] = useState(false)
  const [concurrency, setConcurrency] = useState<number>(2)
  const [previewImage, setPreviewImage] = useState<CompressedImage | null>(null)

  // 获取CPU核心数并设置并发数
  useEffect(() => {
    invoke<number>('get_cpu_count').then(cpuCount => {
      // 使用CPU核心数的一半,最少2个,最多4个
      const optimal = Math.max(2, Math.min(4, Math.floor(cpuCount / 2)))
      setConcurrency(optimal)
      console.log(`CPU核心数: ${cpuCount}, 设置并发数为: ${optimal}`)
    })
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
          },
        ],
      })

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected]
        await addImages(paths)
      }
    } catch (error) {
      console.error('Failed to select files:', error)
    }
  }

  const addImages = async (paths: string[]) => {
    if (paths.length === 0) return
    const resPaths = paths.filter(path => !images.find(img => img.originalPath === path))
    
    // 立即添加占位项到列表
    const placeholderImages: CompressedImage[] = resPaths.map(path => {
      const originalName = path.split(/[\\/]/).pop() || 'unknown'
      return {
        id: Math.random().toString(36).substr(2, 9),
        originalName,
        originalSize: 0,
        compressedSize: 0,
        originalPath: path,
        compressedData: '',
        previewUrl: undefined,
        status: 'loading' as const,
        progress: 0,
      }
    })
    
    setImages(prev => [...prev, ...placeholderImages])

    // 异步加载详细信息
    placeholderImages.forEach(async placeholder => {
      try {
        const fileData = await invoke<string>('read_file_as_base64', { path: placeholder.originalPath })
        const originalSize = await invoke<number>('get_file_size', { path: placeholder.originalPath })
        
        // 更新该项的信息
        setImages(prev =>
          prev.map(img =>
            img.id === placeholder.id
              ? {
                  ...img,
                  originalSize,
                  previewUrl: `data:image/jpeg;base64,${fileData}`,
                  status: 'pending' as const,
                }
              : img
          )
        )
      } catch (error) {
        console.error('Failed to load image:', error)
        // 加载失败,标记为错误
        setImages(prev =>
          prev.map(img =>
            img.id === placeholder.id
              ? {
                  ...img,
                  status: 'error' as const,
                  error: '加载失败',
                }
              : img
          )
        )
      }
    })
  }

  const startCompression = async () => {
    const pendingImages = images.filter(img => img.status === 'pending')
    if (pendingImages.length === 0) return

    setIsProcessing(true)

    // 并发压缩图片
    const compressImage = async (image: CompressedImage) => {
      // 标记为处理中
      setImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, status: 'processing' as const, progress: 0 } : img
        )
      )

      // 监听进度事件
      const unlisten = await listen<number>(`compress-progress-${image.id}`, event => {
        setImages(prev =>
          prev.map(img => (img.id === image.id ? { ...img, progress: event.payload } : img))
        )
      })

      try {
        console.log(`开始压缩图片: ${image.originalPath}`)
        const result = await invoke<{
          original_size: number
          compressed_size: number
          compressed_data: string
        }>('compress_image', {
          path: image.originalPath,
          maxSizeKb: maxSizeKB,
          imageId: image.id,
        })

        console.log(
          `压缩完成: ${image.originalPath}, 原始大小: ${result.original_size}, 压缩后: ${result.compressed_size}`
        )

        setImages(prev =>
          prev.map(img =>
            img.id === image.id
              ? {
                  ...img,
                  originalSize: result.original_size,
                  compressedSize: result.compressed_size,
                  compressedData: result.compressed_data,
                  status: 'success' as const,
                  progress: 100,
                }
              : img
          )
        )
      } catch (error) {
        console.error(`压缩失败: ${image.originalPath}`, error)
        setImages(prev =>
          prev.map(img =>
            img.id === image.id
              ? {
                  ...img,
                  status: 'error' as const,
                  error: String(error),
                  progress: 0,
                }
              : img
          )
        )
      } finally {
        unlisten()
      }
    }

    // 使用并发池控制同时压缩的数量
    const processQueue = async () => {
      const queue = [...pendingImages]
      const processing: Promise<void>[] = []

      while (queue.length > 0 || processing.length > 0) {
        // 填充处理池直到达到并发限制
        while (processing.length < concurrency && queue.length > 0) {
          const image = queue.shift()!
          const promise = compressImage(image).then(() => {
            // 从处理池中移除
            const index = processing.indexOf(promise)
            if (index > -1) processing.splice(index, 1)
          })
          processing.push(promise)
        }

        // 等待至少一个任务完成
        if (processing.length > 0) {
          await Promise.race(processing)
        }
      }
    }

    await processQueue()
    setIsProcessing(false)
  }

  const handleDownload = async (image: CompressedImage) => {
    try {
      const savePath = await save({
        defaultPath: `compressed_${image.originalName}`,
        filters: [
          {
            name: 'Images',
            extensions: [image.originalName.split('.').pop() || 'jpg'],
          },
        ],
      })

      if (savePath) {
        await invoke('save_compressed_image', {
          data: image.compressedData,
          path: savePath,
        })
      }
    } catch (error) {
      console.error('Failed to save image:', error)
    }
  }

  const handleDownloadAll = async () => {
    const successImages = images.filter(img => img.status === 'success')
    if (successImages.length === 0) return

    try {
      // 选择保存位置
      const savePath = await save({
        defaultPath: 'compressed_images.zip',
        filters: [
          {
            name: 'ZIP Archive',
            extensions: ['zip'],
          },
        ],
      })

      if (savePath) {
        // 准备所有图片数据
        const imageData = successImages.map(img => ({
          name: `compressed_${img.originalName}`,
          data: img.compressedData,
        }))

        // 调用 Rust 端打包下载
        await invoke('save_images_as_zip', {
          images: imageData,
          path: savePath,
        })
      }
    } catch (error) {
      console.error('Failed to save zip:', error)
    }
  }

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  const clearAll = () => {
    setImages([])
  }

  // 监听粘贴事件
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('检测到粘贴事件')
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: string[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            try {
              // 保存到临时文件 - 直接读取文件并转为 base64
              const arrayBuffer = await file.arrayBuffer()
              const bytes = new Uint8Array(arrayBuffer)

              // 分块转换,避免栈溢出
              let binary = ''
              const chunkSize = 8192
              for (let j = 0; j < bytes.length; j += chunkSize) {
                const chunk = bytes.subarray(j, Math.min(j + chunkSize, bytes.length))
                binary += String.fromCharCode(...chunk)
              }
              const base64 = btoa(binary)

              const tempPath = await invoke<string>('save_temp_image', {
                data: base64,
                filename: file.name || 'pasted-image.png',
              })
              imageFiles.push(tempPath)
            } catch (error) {
              console.error('Failed to save pasted image:', error)
            }
          }
        }
      }
      console.log('粘贴的图片文件:', imageFiles, images)
      const resImageFiles = imageFiles.filter(
        path => !images.find(img => img.originalPath === path)
      )
      
      if (resImageFiles.length > 0) {
        // 立即添加占位项到列表
        const placeholderImages: CompressedImage[] = resImageFiles.map(path => {
          const originalName = path.split(/[\\/]/).pop() || 'unknown'
          return {
            id: Math.random().toString(36).substr(2, 9),
            originalName,
            originalSize: 0,
            compressedSize: 0,
            originalPath: path,
            compressedData: '',
            previewUrl: undefined,
            status: 'loading' as const,
            progress: 0,
          }
        })
        
        setImages(prev => [...prev, ...placeholderImages])

        // 异步加载详细信息
        placeholderImages.forEach(async placeholder => {
          try {
            const fileData = await invoke<string>('read_file_as_base64', { path: placeholder.originalPath })
            const originalSize = await invoke<number>('get_file_size', { path: placeholder.originalPath })
            
            // 更新该项的信息
            setImages(prev =>
              prev.map(img =>
                img.id === placeholder.id
                  ? {
                      ...img,
                      originalSize,
                      previewUrl: `data:image/jpeg;base64,${fileData}`,
                      status: 'pending' as const,
                    }
                  : img
              )
            )
          } catch (error) {
            console.error('Failed to load image:', error)
            // 加载失败,标记为错误
            setImages(prev =>
              prev.map(img =>
                img.id === placeholder.id
                  ? {
                      ...img,
                      status: 'error' as const,
                      error: '加载失败',
                    }
                  : img
              )
            )
          }
        })
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [images])

  const hasPendingImages = images.some(img => img.status === 'pending')
  const hasSuccessImages = images.some(img => img.status === 'success')
  const hasLoadingImages = images.some(img => img.status === 'loading')

  return (
    <ToolLayout
      title='图片压缩'
      description='支持 PNG、JPG、WEBP、BMP、GIF 等常见格式'
      actions={[
        <Button onClick={handleDownloadAll} disabled={!hasSuccessImages} variant='outline'>
          <Package className='mr-2 h-4 w-4' />
          打包下载
        </Button>,
      ]}
    >
      {/* 图片列表 */}
      {images.length > 0 && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>
              压缩队列 ({images.filter(img => img.status === 'success').length}/{images.length})
            </h3>
            <div className='flex gap-2'>
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium'>期望目标大小 (KB):</label>
                <Input
                  type='number'
                  value={maxSizeKB}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setMaxSizeKB(Number(e.target.value))
                  }
                  className='h-8 w-32'
                  min='10'
                  max='10000'
                />
              </div>
              <Button onClick={clearAll} variant='outline' size='sm'>
                清空列表
              </Button>
              <Button
                size='sm'
                onClick={startCompression}
                disabled={isProcessing || !hasPendingImages || hasLoadingImages}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    压缩中...
                  </>
                ) : (
                  <>
                    <Upload className='mr-2 h-4 w-4' />
                    开始压缩
                  </>
                )}
              </Button>
            </div>
          </div>

          <ScrollArea className='h-[calc(100vh-144px)] rounded-md border p-3'>
            <div className='space-y-2'>
              {/* 上传图片按钮项 */}
              <div
                onClick={handleFileSelect}
                className='border-muted-foreground/25 hover:bg-accent flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed p-3 transition-colors'
              >
                <Upload className='h-4 w-4' />
                <span className='text-sm font-medium'>添加更多图片</span>
              </div>

              {/* 图片列表 */}
              {images.map(image => (
                <Item
                  key={image.id}
                  variant='outline'
                  size='sm'
                  className='relative overflow-hidden'
                >
                  {/* 进度条背景 */}
                  {image.status === 'processing' && (
                    <div
                      className='absolute inset-0 z-0 bg-blue-500/10 transition-all duration-300'
                      style={{ width: `${image.progress}%` }}
                    />
                  )}

                  {/* 图片预览 */}
                  <ItemMedia
                    variant='image'
                    className='relative z-10 cursor-pointer transition-opacity hover:opacity-80'
                    onClick={() => image.status !== 'loading' && setPreviewImage(image)}
                  >
                    {image.status === 'loading' ? (
                      <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
                    ) : image.status === 'processing' ? (
                      <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
                    ) : image.status === 'success' && image.compressedData ? (
                      <img
                        src={`data:image/jpeg;base64,${image.compressedData}`}
                        alt={image.originalName}
                      />
                    ) : image.previewUrl ? (
                      <img src={image.previewUrl} alt={image.originalName} />
                    ) : (
                      <ImageIcon className='text-muted-foreground h-5 w-5' />
                    )}
                  </ItemMedia>

                  {/* 文件信息 */}
                  <ItemContent className='relative z-10'>
                    <ItemTitle>
                      <span className='truncate text-sm font-medium'>{image.originalName}</span>
                    </ItemTitle>
                    <ItemDescription className='flex items-center gap-2'>
                      {image.status === 'loading' && (
                        <Badge variant='outline' className='text-xs'>
                          加载中...
                        </Badge>
                      )}
                      {image.status === 'pending' && (
                        <Badge variant='secondary' className='text-xs'>
                          等待压缩
                          {image.originalSize > 0 && `(${formatFileSize(image.originalSize)})`}
                        </Badge>
                      )}
                      {image.status === 'processing' && (
                        <Badge variant='default' className='text-xs'>
                          处理中 {image.progress}%
                        </Badge>
                      )}
                      {image.status === 'success' && (
                        <>
                          <span>{formatFileSize(image.originalSize)}</span>
                          <span>→</span>
                          <span className='font-medium text-green-600'>
                            {formatFileSize(image.compressedSize)}
                          </span>
                          <Badge variant='secondary' className='text-xs'>
                            减少{' '}
                            {(
                              ((image.originalSize - image.compressedSize) / image.originalSize) *
                              100
                            ).toFixed(1)}
                            %
                          </Badge>
                        </>
                      )}
                      {image.status === 'error' && (
                        <Badge variant='destructive' className='text-xs'>
                          {image.error}
                        </Badge>
                      )}
                    </ItemDescription>
                  </ItemContent>

                  {/* 操作按钮 */}
                  <ItemActions className='relative z-10'>
                    {image.status === 'success' && (
                      <Button
                        onClick={() => handleDownload(image)}
                        size='sm'
                        variant='default'
                        className='h-8'
                      >
                        <Download className='h-3.5 w-3.5' />
                      </Button>
                    )}
                    <Button
                      onClick={() => removeImage(image.id)}
                      variant='ghost'
                      size='sm'
                      className='h-8'
                    >
                      <X className='h-3.5 w-3.5' />
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {images.length === 0 && (
        <div
          onClick={handleFileSelect}
          className='border-muted-foreground/25 hover:bg-accent flex h-[calc(100vh-144px)] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors'
        >
          <ImageIcon className='text-muted-foreground mb-4 h-12 w-12' />
          <h3 className='mb-2 text-lg font-semibold'>点击选择图片或使用 Ctrl+V 粘贴</h3>
          <p className='text-muted-foreground text-sm'>
            支持 PNG、JPG、WEBP、BMP、GIF 等格式,可多选
          </p>
        </div>
      )}

      {/* 图片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-auto'>
          <DialogTitle>{previewImage?.originalName}</DialogTitle>
          <DialogDescription>
            {previewImage?.status === 'success' ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-4 text-sm'>
                  <Badge variant='secondary'>
                    原始大小: {formatFileSize(previewImage.originalSize)}
                  </Badge>
                  <Badge variant='secondary'>
                    压缩后: {formatFileSize(previewImage.compressedSize)}
                  </Badge>
                  <Badge variant='default'>
                    减少{' '}
                    {(
                      ((previewImage.originalSize - previewImage.compressedSize) /
                        previewImage.originalSize) *
                      100
                    ).toFixed(1)}
                    %
                  </Badge>
                </div>
                <img
                  src={`data:image/jpeg;base64,${previewImage.compressedData}`}
                  alt={previewImage.originalName}
                  className='h-auto w-full rounded-lg'
                />
              </div>
            ) : previewImage?.previewUrl ? (
              <img
                src={previewImage.previewUrl}
                alt={previewImage.originalName}
                className='h-auto w-full rounded-lg'
              />
            ) : null}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </ToolLayout>
  )
}
