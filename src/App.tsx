import { CommandPalette } from './components/features/CommandPalette'

function App() {
  return (
    <div className='bg-background h-screen'>
      <main className='container mx-auto p-4'>
        <h1 className='text-foreground text-2xl font-bold'>Welcome to Leap</h1>
        <p className='text-muted-foreground mt-2'>
          Press <kbd className='bg-muted rounded px-2 py-1 text-sm'>Ctrl + Space</kbd> to open
          command palette
        </p>
      </main>

      <CommandPalette />
    </div>
  )
}

export default App
