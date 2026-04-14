import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchElements } from '../api/client'
import type { Element } from '../api/types'

type Ctx = {
  elements: Element[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Merge or insert an element so lists and trees update without a full refetch. */
  upsertElement: (el: Element) => void
}

const ElementsContext = createContext<Ctx | null>(null)

export function ElementsProvider({ children }: { children: ReactNode }) {
  const [elements, setElements] = useState<Element[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchElements({ limit: 500 })
      setElements(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const upsertElement = useCallback((el: Element) => {
    setElements((prev) => {
      const i = prev.findIndex((x) => x.id === el.id)
      if (i === -1) return [el, ...prev]
      const next = [...prev]
      next[i] = el
      return next
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <ElementsContext.Provider value={{ elements, loading, error, refresh, upsertElement }}>
      {children}
    </ElementsContext.Provider>
  )
}

export function useElementsData(): Ctx {
  const c = useContext(ElementsContext)
  if (!c) throw new Error('useElementsData must be used under ElementsProvider')
  return c
}
