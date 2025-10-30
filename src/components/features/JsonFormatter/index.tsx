import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { JsonTreeNode } from '@/components/JsonTreeNode'

interface JsonFormatterProps {
  onBack: () => void
}

export function JsonFormatter({ onBack }: JsonFormatterProps) {
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

  return (
    <div className='flex h-screen w-full flex-col bg-white p-4 dark:bg-gray-900'>
      {/* 顶部控制栏 */}
      <div className='mb-4 space-y-3'>
        {/* 标题和按钮行 */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon' onClick={onBack} className='h-8 w-8'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
            <h2 className='text-lg font-semibold'>JSON 格式化</h2>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={clearAll}>
              清空
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={copyMinified}
              disabled={!parsedData}
              className='gap-2'
            >
              {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
              复制压缩
            </Button>
            <Button size='sm' onClick={copyFormatted} disabled={!parsedData} className='gap-2'>
              {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
              复制格式化
            </Button>
          </div>
        </div>

        {/* 输入框行 */}
        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='粘贴 JSON 到这里...'
            className='h-20 w-full resize-none rounded-md border border-gray-300 bg-white p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800'
          />
        </div>
      </div>

      {/* 树形视图区域（最大化） */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {error ? (
          <div className='flex-1 overflow-auto rounded-md border border-red-300 bg-red-50 p-4 font-mono text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'>
            错误: {error}
          </div>
        ) : parsedData ? (
          <div className='flex-1 overflow-auto rounded-md border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800'>
            <JsonTreeNode data={parsedData} isRoot />
          </div>
        ) : (
          <div className='flex flex-1 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-400 dark:border-gray-700'>
            在上方输入 JSON 即可查看树形结构
          </div>
        )}
      </div>
    </div>
  )
}
