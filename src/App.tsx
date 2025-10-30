import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatedOutlet } from './components/AnimatedOutlet'
import { CommandPage } from './pages/CommandPage'
import { CalculatorPage } from './pages/CalculatorPage'
import { useWindowResize } from './hooks/useWindowResize'

function AppLayout() {
  useWindowResize()
  return <AnimatedOutlet />
}

function App() {
  return (
    <BrowserRouter>
      <div className='bg-background h-screen'>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path='/' element={<CommandPage />} />
            <Route path='/calculator' element={<CalculatorPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
