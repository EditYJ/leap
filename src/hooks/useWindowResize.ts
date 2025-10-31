import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'

const routeSizes: Record<string, { width: number; height: number }> = {
  '/': { width: 600, height: 340 },
  '/calculator': { width: 360, height: 524 },
  '/json-formatter': { width: 750, height: 600 },
  '/image-compressor': { width: 750, height: 600 },
  '/pdf-merger': { width: 800, height: 700 },
}

export function useWindowResize() {
  const location = useLocation()

  useEffect(() => {
    const size = routeSizes[location.pathname]
    if (size) {
      invoke('animate_window_resize', {
        targetWidth: size.width,
        targetHeight: size.height,
      })
    }
  }, [location.pathname])
}
