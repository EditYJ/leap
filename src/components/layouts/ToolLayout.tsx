import { useNavigate } from 'react-router-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ToolLayoutProps {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function ToolLayout({ title, children, actions }: ToolLayoutProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/')
  }

  // ESC 键返回
  useHotkeys('esc', handleBack)

  return (
    <div className='flex h-screen w-full flex-col bg-white p-4 dark:bg-gray-900'>
      {/* 顶部导航栏 */}
      <div className='mb-4 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='icon' onClick={handleBack} className='h-8 w-8'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <h2 className='text-lg font-semibold'>{title}</h2>
        </div>
        {actions && <div className='flex gap-2'>{actions}</div>}
      </div>

      {/* 内容区域 */}
      <div className='flex flex-1 flex-col'>{children}</div>
    </div>
  )
}
