import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface CalculatorProps {
  onBack: () => void
}

export function Calculator({ onBack }: CalculatorProps) {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? digit : display + digit)
    }
  }

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.')
    }
  }

  const clear = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperation(null)
    setWaitingForOperand(false)
  }

  const formatDisplay = (value: number): string => {
    // 如果数字太长，限制小数位数
    const str = String(value)
    if (str.length > 12) {
      // 科学计数法用于非常大或非常小的数字
      if (Math.abs(value) > 1e10 || (Math.abs(value) < 1e-6 && value !== 0)) {
        return value.toExponential(6)
      }
      // 否则限制小数位数
      return value.toPrecision(10)
    }
    return str
  }

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operation) {
      const currentValue = previousValue || 0
      let newValue = currentValue

      switch (operation) {
        case '+':
          newValue = currentValue + inputValue
          break
        case '-':
          newValue = currentValue - inputValue
          break
        case '×':
          newValue = currentValue * inputValue
          break
        case '÷':
          newValue = currentValue / inputValue
          break
        case '=':
          newValue = inputValue
          break
        default:
          break
      }

      setDisplay(formatDisplay(newValue))
      setPreviousValue(newValue)
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const buttonClass =
    'h-14 text-lg font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-gray-800'
  const operatorClass =
    'h-14 text-lg font-semibold bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700'

  return (
    <div className='h-screen w-full bg-white p-4 dark:bg-gray-900'>
      <div className='mb-4 flex items-center gap-2'>
        <Button variant='ghost' size='icon' onClick={onBack} className='h-8 w-8'>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h2 className='text-lg font-semibold'>计算器</h2>
      </div>

      <div className='mb-4 rounded-lg bg-gray-100 p-4 text-right dark:bg-gray-800'>
        <div
          className={`overflow-hidden font-bold break-all ${
            display.length > 12 ? 'text-xl' : display.length > 8 ? 'text-2xl' : 'text-3xl'
          }`}
        >
          {display}
        </div>
      </div>

      <div className='grid grid-cols-4 gap-2'>
        <Button variant='outline' className={buttonClass} onClick={clear}>
          C
        </Button>
        <Button
          variant='outline'
          className={buttonClass}
          onClick={() => setDisplay(String(-parseFloat(display)))}
        >
          +/-
        </Button>
        <Button
          variant='outline'
          className={buttonClass}
          onClick={() => setDisplay(String(parseFloat(display) / 100))}
        >
          %
        </Button>
        <Button className={operatorClass} onClick={() => performOperation('÷')}>
          ÷
        </Button>

        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('7')}>
          7
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('8')}>
          8
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('9')}>
          9
        </Button>
        <Button className={operatorClass} onClick={() => performOperation('×')}>
          ×
        </Button>

        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('4')}>
          4
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('5')}>
          5
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('6')}>
          6
        </Button>
        <Button className={operatorClass} onClick={() => performOperation('-')}>
          -
        </Button>

        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('1')}>
          1
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('2')}>
          2
        </Button>
        <Button variant='outline' className={buttonClass} onClick={() => inputDigit('3')}>
          3
        </Button>
        <Button className={operatorClass} onClick={() => performOperation('+')}>
          +
        </Button>

        <Button
          variant='outline'
          className={`${buttonClass} col-span-2`}
          onClick={() => inputDigit('0')}
        >
          0
        </Button>
        <Button variant='outline' className={buttonClass} onClick={inputDecimal}>
          .
        </Button>
        <Button className={operatorClass} onClick={() => performOperation('=')}>
          =
        </Button>
      </div>
    </div>
  )
}
