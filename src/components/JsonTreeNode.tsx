import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface JsonTreeNodeProps {
  data: any
  name?: string
  isRoot?: boolean
  depth?: number
}

export function JsonTreeNode({ data, name, isRoot = false, depth = 0 }: JsonTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2) // 默认展开前两层

  const getValueType = (value: any): string => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }

  const getValuePreview = (value: any): string => {
    const type = getValueType(value)
    switch (type) {
      case 'object':
        const keys = Object.keys(value)
        return `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`
      case 'array':
        return `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`
      case 'string':
        return `"${value}"`
      case 'null':
        return 'null'
      default:
        return String(value)
    }
  }

  const getTypeColorClass = (type: string): string => {
    switch (type) {
      case 'string':
        return 'text-green-600 dark:text-green-400'
      case 'number':
        return 'text-blue-600 dark:text-blue-400'
      case 'boolean':
        return 'text-purple-600 dark:text-purple-400'
      case 'null':
        return 'text-muted-foreground'
      case 'object':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'array':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-foreground'
    }
  }

  const getTypeBadgeVariant = (
    type: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'string':
        return 'default'
      case 'number':
        return 'secondary'
      case 'boolean':
        return 'outline'
      case 'null':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const type = getValueType(data)
  const isExpandable = type === 'object' || type === 'array'
  const isPrimitive = !isExpandable

  // 原始值直接渲染
  if (isPrimitive) {
    return (
      <div
        className='hover:bg-accent flex items-center gap-2 rounded px-2 py-1'
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {name && <span className='text-foreground font-mono text-sm font-medium'>{name}:</span>}
        <span className={cn('font-mono text-sm', getTypeColorClass(type))}>
          {getValuePreview(data)}
        </span>
        {depth === 0 && (
          <Badge variant={getTypeBadgeVariant(type)} className='ml-2 text-xs'>
            {type}
          </Badge>
        )}
      </div>
    )
  }

  // 对象或数组
  const entries = Array.isArray(data)
    ? data.map((item, index) => ({ key: String(index), value: item }))
    : Object.entries(data).map(([key, value]) => ({ key, value }))

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors',
          'hover:bg-accent hover:text-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpandable && (
          <span className='shrink-0'>
            {isExpanded ? (
              <ChevronDown className='text-muted-foreground h-3.5 w-3.5' />
            ) : (
              <ChevronRight className='text-muted-foreground h-3.5 w-3.5' />
            )}
          </span>
        )}
        {name && !isRoot && (
          <span className='text-foreground font-mono text-sm font-medium'>{name}:</span>
        )}
        <span className={cn('font-mono text-sm', getTypeColorClass(type))}>
          {isExpanded ? (type === 'array' ? '[' : '{') : getValuePreview(data)}
        </span>
      </div>

      {isExpanded && (
        <div>
          {entries.map(({ key, value }) => (
            <JsonTreeNode key={key} data={value} name={key} depth={depth + 1} />
          ))}
          <div
            className='text-muted-foreground px-2 py-1 font-mono text-sm'
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {type === 'array' ? ']' : '}'}
          </div>
        </div>
      )}
    </div>
  )
}
