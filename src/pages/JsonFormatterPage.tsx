import { JsonFormatter } from '@/components/features/JsonFormatter'
import { useNavigate } from 'react-router-dom'

export function JsonFormatterPage() {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/')
  }

  return <JsonFormatter onBack={handleBack} />
}
