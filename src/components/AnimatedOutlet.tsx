import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import type { Transition } from 'framer-motion'

const pageVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
}

const pageTransition: Transition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.1,
}

export function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode='wait'>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial='initial'
        animate='animate'
        exit='exit'
        transition={pageTransition}
        className='h-full w-full'
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
