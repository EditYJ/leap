import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemActions,
} from '@/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Upload, X, ImageIcon, FileText, Download } from 'lucide-react'
import { ToolLayout } from '@/components/layouts/ToolLayout'

interface ImageItem {
  id: string
  name: string
  path: string
  previewUrl: string
}

export function PdfMerger() {
  const [text, setText] = useState('')
  const [images, setImages] = useState<ImageItem[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  const handleImageSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'],
          },
        ],
      })

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected]
        await addImages(paths)
      }
    } catch (error) {
      console.error('Failed to select images:', error)
    }
  }

  const addImages = async (paths: string[]) => {
    const newImages: ImageItem[] = await Promise.all(
      paths.map(async path => {
        let previewUrl = ''
        try {
          const fileData = await invoke<string>('read_file_as_base64', { path })
          previewUrl = `data:image/jpeg;base64,${fileData}`
        } catch (error) {
          console.error('Failed to read image:', error)
        }

        const name = path.split(/[\\/]/).pop() || 'unknown'
        return {
          id: Math.random().toString(36).substr(2, 9),
          name,
          path,
          previewUrl,
        }
      })
    )

    setImages(prev => [...prev, ...newImages])
  }

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  const clearAll = () => {
    setText('')
    setImages([])
  }

  const handleGeneratePdf = async () => {
    if (!text && images.length === 0) {
      return
    }

    try {
      setIsGenerating(true)

      const savePath = await save({
        defaultPath: 'output.pdf',
        filters: [
          {
            name: 'PDF',
            extensions: ['pdf'],
          },
        ],
      })

      if (savePath) {
        await invoke('generate_pdf', {
          text,
          imagePaths: images.map(img => img.path),
          outputPath: savePath,
        })
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: string[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const bytes = new Uint8Array(arrayBuffer)

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

    if (imageFiles.length > 0) {
      await addImages(imageFiles)
    }
  }

  return (
    <ToolLayout
      title='PDF 生成器'
      description='将文本和图片合并为 A4 大小的 PDF 文档'
      actions={[
        <Button onClick={clearAll} variant='outline' disabled={!text && images.length === 0}>
          <X className='mr-2 h-4 w-4' />
          清空
        </Button>,
        <Button
          onClick={handleGeneratePdf}
          disabled={(!text && images.length === 0) || isGenerating}
        >
          <Download className='mr-2 h-4 w-4' />
          {isGenerating ? '生成中...' : '生成 PDF'}
        </Button>,
      ]}
    >
      <div className='space-y-4'>
        {/* 文本输入区域 */}
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <FileText className='h-4 w-4' />
            <h3 className='text-sm font-semibold'>文本内容</h3>
          </div>
          <Textarea
            placeholder='输入文本内容...'
            value={text}
            onChange={handleTextChange}
            className='min-h-[200px] resize-none'
          />
        </div>

        {/* 图片列表 */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <ImageIcon className='h-4 w-4' />
              <h3 className='text-sm font-semibold'>图片列表 ({images.length})</h3>
            </div>
            <Button onClick={handleImageSelect} size='sm' variant='outline'>
              <Upload className='mr-2 h-3.5 w-3.5' />
              添加图片
            </Button>
          </div>

          {images.length > 0 ? (
            <ScrollArea className='h-[calc(100vh-500px)] rounded-md border p-3'>
              <div className='space-y-2'>
                {images.map(image => (
                  <Item key={image.id} variant='outline' size='sm'>
                    <ItemMedia variant='image'>
                      <img src={image.previewUrl} alt={image.name} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <span className='truncate text-sm'>{image.name}</span>
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Button onClick={() => removeImage(image.id)} variant='ghost' size='sm'>
                        <X className='h-3.5 w-3.5' />
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div
              onClick={handleImageSelect}
              onPaste={handlePaste}
              className='border-muted-foreground/25 hover:bg-accent flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors'
            >
              <div className='text-center'>
                <ImageIcon className='text-muted-foreground mx-auto mb-2 h-8 w-8' />
                <p className='text-muted-foreground text-sm'>点击添加图片或使用 Ctrl+V 粘贴</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  )
}
