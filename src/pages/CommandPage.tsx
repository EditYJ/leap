import { useState, useEffect } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Calculator as CalculatorIcon, Braces, AppWindow, ImageDown } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'

interface AppInfo {
  name: string
  path: string
  icon: string | null
}

export function CommandPage() {
  const navigate = useNavigate()
  const [installedApps, setInstalledApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 组件挂载时获取已安装的应用列表
    const fetchApps = async () => {
      try {
        const apps = await invoke<AppInfo[]>('get_installed_apps')
        setInstalledApps(apps)
      } catch (error) {
        console.error('Failed to get installed apps:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchApps()
  }, [])

  const handleItemSelect = (action: () => void) => {
    action()
    invoke('toggle_window')
  }

  const openCalculator = () => {
    navigate('/calculator')
  }

  const openJsonFormatter = () => {
    navigate('/json-formatter')
  }

  const openImageCompressor = () => {
    navigate('/image-compressor')
  }

  const launchApp = async (path: string) => {
    try {
      await invoke('launch_app', { path })
    } catch (error) {
      console.error('Failed to launch app:', error)
    }
  }

  return (
    <div className='flex h-screen w-full items-start justify-center'>
      <Command>
        <CommandInput placeholder='搜索应用、文件等...' />
        <CommandList>
          <CommandEmpty>没有找到结果。</CommandEmpty>
          <CommandGroup heading='工具'>
            <CommandItem onSelect={openCalculator}>
              <CalculatorIcon className='h-4 w-4' />
              <span>计算器</span>
            </CommandItem>
            <CommandItem onSelect={openJsonFormatter}>
              <Braces className='h-4 w-4' />
              <span>JSON 格式化</span>
            </CommandItem>
            <CommandItem onSelect={openImageCompressor}>
              <ImageDown className='h-4 w-4' />
              <span>图片压缩</span>
            </CommandItem>
          </CommandGroup>
          {!loading && installedApps.length > 0 && (
            <CommandGroup heading='应用程序'>
              {installedApps.map(app => (
                <CommandItem
                  key={app.path}
                  onSelect={() => handleItemSelect(() => launchApp(app.path))}
                >
                  {app.icon ? (
                    <img src={app.icon} alt={app.name} className='h-4 w-4 object-contain' />
                  ) : (
                    <AppWindow className='h-4 w-4' />
                  )}
                  <span>{app.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )
}
