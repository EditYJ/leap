import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { CommandPalette } from './components/features/CommandPalette'

function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // 全局快捷键：ctrl + Space
  useHotkeys('ctrl+space', () => {
    setIsCommandPaletteOpen(true)
  })

  return (
    <div className='bg-background h-screen'>
      <main className='container mx-auto p-4'>
        <h1 className='text-foreground text-2xl font-bold'>Welcome to Leap</h1>
        <p className='text-muted-foreground mt-2'>
          Press <kbd className='bg-muted rounded px-2 py-1 text-sm'>Ctrl + Space</kbd> to open
          command palette
        </p>
      </main>

      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
    </div>
  )
}

export default App
