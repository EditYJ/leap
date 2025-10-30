import { Calculator } from '@/components/features/Calculator'
import { useNavigate } from 'react-router-dom'

export function CalculatorPage() {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/')
  }

  return <Calculator onBack={handleBack} />
}
