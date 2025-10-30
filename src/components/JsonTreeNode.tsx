import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

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

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'string':
        return 'text-green-600 dark:text-green-400'
      case 'number':
        return 'text-blue-600 dark:text-blue-400'
      case 'boolean':
        return 'text-purple-600 dark:text-purple-400'
      case 'null':
        return 'text-gray-500 dark:text-gray-400'
      case 'object':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'array':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-gray-700 dark:text-gray-300'
    }
  }

  const type = getValueType(data)
  const isExpandable = type === 'object' || type === 'array'
  const isPrimitive = !isExpandable

  // 原始值直接渲染
  if (isPrimitive) {
    return (
      <div className='flex items-center gap-2 py-0.5 text-sm' style={{ paddingLeft: `${depth * 16}px` }}>
        {name && (
          <>
            <span className='font-medium text-gray-700 dark:text-gray-300'>{name}:</span>
          </>
        )}
        <span className={getTypeColor(type)}>{getValuePreview(data)}</span>
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
        className='flex cursor-pointer items-center gap-1 py-0.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpandable && (
          <span className='shrink-0'>
            {isExpanded ? (
              <ChevronDown className='h-3.5 w-3.5 text-gray-500' />
            ) : (
              <ChevronRight className='h-3.5 w-3.5 text-gray-500' />
            )}
          </span>
        )}
        {name && !isRoot && (
          <span className='font-medium text-gray-700 dark:text-gray-300'>{name}:</span>
        )}
        <span className={`${getTypeColor(type)} ${isExpanded ? '' : 'ml-1'}`}>
          {isExpanded ? (type === 'array' ? '[' : '{') : getValuePreview(data)}
        </span>
      </div>

      {isExpanded && (
        <div>
          {entries.map(({ key, value }) => (
            <JsonTreeNode key={key} data={value} name={key} depth={depth + 1} />
          ))}
          <div
            className='py-0.5 text-sm text-gray-500 dark:text-gray-400'
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {type === 'array' ? ']' : '}'}
          </div>
        </div>
      )}
    </div>
  )
}
