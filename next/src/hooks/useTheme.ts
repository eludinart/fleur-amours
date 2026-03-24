'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

export function useTheme() {
  const theme = useStore((s) => s.theme)
  const toggle = useStore((s) => s.toggleTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  return { theme, toggle }
}
