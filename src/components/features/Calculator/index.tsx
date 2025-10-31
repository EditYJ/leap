import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ToolLayout } from '@/components/layouts/ToolLayout'
import { cn } from '@/lib/utils'

interface CalculatorProps {}

export function Calculator(_props: CalculatorProps) {
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

  return (
    <ToolLayout title='计算器'>
      {/* 显示屏 */}
      <div className='mb-3 rounded-xl bg-linear-to-br from-gray-50 to-gray-100 p-5 shadow-inner dark:from-gray-900 dark:to-gray-800'>
        <div
          className={cn(
            'overflow-hidden text-right font-mono font-bold break-all transition-all',
            display.length > 12 ? 'text-2xl' : display.length > 8 ? 'text-3xl' : 'text-4xl',
            'text-gray-900 dark:text-gray-100'
          )}
        >
          {display}
        </div>
      </div>

      {/* 按钮网格 */}
      <div className='grid grid-cols-4 gap-2'>
        {/* 第一行: C, +/-, %, ÷ */}
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-lg font-semibold hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400'
          onClick={clear}
        >
          C
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-lg font-semibold'
          onClick={() => setDisplay(String(-parseFloat(display)))}
        >
          +/−
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-lg font-semibold'
          onClick={() => setDisplay(String(parseFloat(display) / 100))}
        >
          %
        </Button>
        <Button
          size='lg'
          className='h-16 bg-orange-500 text-xl font-bold hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700'
          onClick={() => performOperation('÷')}
        >
          ÷
        </Button>

        {/* 第二行: 7, 8, 9, × */}
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('7')}
        >
          7
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('8')}
        >
          8
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('9')}
        >
          9
        </Button>
        <Button
          size='lg'
          className='h-16 bg-orange-500 text-xl font-bold hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700'
          onClick={() => performOperation('×')}
        >
          ×
        </Button>

        {/* 第三行: 4, 5, 6, - */}
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('4')}
        >
          4
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('5')}
        >
          5
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('6')}
        >
          6
        </Button>
        <Button
          size='lg'
          className='h-16 bg-orange-500 text-xl font-bold hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700'
          onClick={() => performOperation('-')}
        >
          −
        </Button>

        {/* 第四行: 1, 2, 3, + */}
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('1')}
        >
          1
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('2')}
        >
          2
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={() => inputDigit('3')}
        >
          3
        </Button>
        <Button
          size='lg'
          className='h-16 bg-orange-500 text-xl font-bold hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700'
          onClick={() => performOperation('+')}
        >
          +
        </Button>

        {/* 第五行: 0 (跨两列), ., = */}
        <Button
          variant='outline'
          size='lg'
          className='col-span-2 h-16 text-xl font-semibold'
          onClick={() => inputDigit('0')}
        >
          0
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='h-16 text-xl font-semibold'
          onClick={inputDecimal}
        >
          .
        </Button>
        <Button
          size='lg'
          className='h-16 bg-green-500 text-xl font-bold hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'
          onClick={() => performOperation('=')}
        >
          =
        </Button>
      </div>
    </ToolLayout>
  )
}
