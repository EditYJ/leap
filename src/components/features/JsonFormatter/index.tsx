import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, FileJson, Minimize2, Trash2 } from 'lucide-react'
import { JsonTreeNode } from '@/components/JsonTreeNode'
import { ToolLayout } from '@/components/layouts/ToolLayout'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface JsonFormatterProps {}

export function JsonFormatter(_props: JsonFormatterProps) {
  const [input, setInput] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // 自动解析
  useEffect(() => {
    if (!input.trim()) {
      setParsedData(null)
      setError('')
      return
    }

    try {
      const parsed = JSON.parse(input)
      setParsedData(parsed)
      setError('')
    } catch (e) {
      setError((e as Error).message)
      setParsedData(null)
    }
  }, [input])

  const copyFormatted = async () => {
    if (parsedData) {
      const formatted = JSON.stringify(parsedData, null, 2)
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyMinified = async () => {
    if (parsedData) {
      const minified = JSON.stringify(parsedData)
      await navigator.clipboard.writeText(minified)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const clearAll = () => {
    setInput('')
    setParsedData(null)
    setError('')
    setCopied(false)
  }

  // 获取 JSON 统计信息
  const getJsonStats = () => {
    if (!parsedData) return null

    const isArray = Array.isArray(parsedData)
    const isObject = typeof parsedData === 'object' && !isArray

    if (isArray) {
      return { type: 'Array', count: parsedData.length }
    } else if (isObject) {
      return { type: 'Object', count: Object.keys(parsedData).length }
    }
    return null
  }

  const stats = getJsonStats()

  const actions = (
    <>
      <Button variant='outline' size='sm' onClick={clearAll}>
        <Trash2 className='mr-2 h-4 w-4' />
        清空
      </Button>
      <Button variant='outline' size='sm' onClick={copyMinified} disabled={!parsedData}>
        <Minimize2 className='mr-2 h-4 w-4' />
        复制压缩
      </Button>
      <Button size='sm' onClick={copyFormatted} disabled={!parsedData}>
        {copied ? (
          <>
            <Check className='mr-2 h-4 w-4' />
            已复制
          </>
        ) : (
          <>
            <Copy className='mr-2 h-4 w-4' />
            复制格式化
          </>
        )}
      </Button>
    </>
  )

  return (
    <ToolLayout title='JSON 格式化' actions={actions}>
      {/* 输入框 */}
      <div className='mb-3'>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='粘贴 JSON 到这里...'
          className='h-20 resize-none font-mono text-sm'
        />
      </div>

      {/* 状态栏 */}
      {stats && (
        <div className='mb-3 flex items-center gap-2'>
          <Badge variant='secondary' className='gap-1'>
            <FileJson className='h-3 w-3' />
            {stats.type}
          </Badge>
          <Badge variant='outline'>
            {stats.count} {stats.type === 'Array' ? 'items' : 'keys'}
          </Badge>
        </div>
      )}

      {/* 树形视图区域 */}
      {error ? (
        <Alert variant='destructive'>
          <AlertDescription className='font-mono text-sm'>{error}</AlertDescription>
        </Alert>
      ) : parsedData ? (
        <ScrollArea className='h-[calc(100vh-208px)] rounded-md border'>
          <div className='p-4'>
            <JsonTreeNode data={parsedData} isRoot />
          </div>
        </ScrollArea>
      ) : (
        <div className='flex h-[calc(100vh-208px)] items-center justify-center rounded-md border-2 border-dashed'>
          <div className='text-muted-foreground text-center'>
            <FileJson className='mx-auto mb-2 h-8 w-8 opacity-50' />
            <p className='text-sm'>在上方输入 JSON 即可查看树形结构</p>
          </div>
        </div>
      )}
    </ToolLayout>
  )
}
