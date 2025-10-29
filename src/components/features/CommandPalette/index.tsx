import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Calculator,
  Clipboard,
  Globe,
  Settings,
  Terminal,
  FileText,
  Mail,
  Music,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface CommandPaletteProps {}

export function CommandPalette(_props: CommandPaletteProps) {
  const handleItemSelect = (action: () => void) => {
    action()
    invoke('toggle_window')
  }

  return (
    <CommandDialog open={true}>
      <CommandInput placeholder='搜索应用、文件等...' />
      <CommandList>
        <CommandEmpty>没有找到结果。</CommandEmpty>

        <CommandGroup heading='应用程序'>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Launch Chrome'))}>
            <Globe className='h-4 w-4' />
            <span>Google Chrome</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Launch Terminal'))}>
            <Terminal className='h-4 w-4' />
            <span>终端</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Launch Settings'))}>
            <Settings className='h-4 w-4' />
            <span>系统设置</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Launch Mail'))}>
            <Mail className='h-4 w-4' />
            <span>邮件</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading='工具'>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Calculator'))}>
            <Calculator className='h-4 w-4' />
            <span>计算器</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Clipboard'))}>
            <Clipboard className='h-4 w-4' />
            <span>剪贴板历史</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Text Editor'))}>
            <FileText className='h-4 w-4' />
            <span>文本编辑器</span>
          </CommandItem>
          <CommandItem onSelect={() => handleItemSelect(() => console.log('Music Player'))}>
            <Music className='h-4 w-4' />
            <span>音乐播放器</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
