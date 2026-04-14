import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type AiTracePayload = {
  kind?: string
  model?: string | null
  summary?: string
  key_prompt?: string
  assistant_excerpt?: string
  llm_request?: string
}

export type AiChatMessage = {
  id: string
  at: number
  title: string
  summary?: string
  promptKey?: string
  response?: string
}

type ActiveOp = { id: string; at: number; label: string; detail: string; promptKey?: string; liveResponse?: string; liveReasoning?: string } | null

type Ctx = {
  messages: AiChatMessage[]
  activeOp: ActiveOp
  startOperation: (label: string, detail: string, promptKey?: string) => void
  appendLiveResponse: (chunk: string) => void
  setLiveResponse: (fullText: string) => void
  appendLiveReasoning: (chunk: string) => void
  endOperation: () => void
  pushTrace: (title: string, trace: AiTracePayload) => void
  pushNote: (title: string, body: string) => void
  clear: () => void
}

const AiChatContext = createContext<Ctx | null>(null)

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [activeOp, setActiveOp] = useState<ActiveOp>(null)

  const startOperation = useCallback((label: string, detail: string, promptKey?: string) => {
    setActiveOp({ id: uid(), at: Date.now(), label, detail, promptKey })
  }, [])

  const endOperation = useCallback(() => {
    setActiveOp(null)
  }, [])

  const appendLiveResponse = useCallback((chunk: string) => {
    if (!chunk) return
    setActiveOp((prev) => (prev ? { ...prev, liveResponse: `${prev.liveResponse || ''}${chunk}` } : prev))
  }, [])

  const setLiveResponse = useCallback((fullText: string) => {
    setActiveOp((prev) => (prev ? { ...prev, liveResponse: fullText || '' } : prev))
  }, [])

  const appendLiveReasoning = useCallback((chunk: string) => {
    if (!chunk) return
    setActiveOp((prev) => (prev ? { ...prev, liveReasoning: `${prev.liveReasoning || ''}${chunk}` } : prev))
  }, [])

  const pushTrace = useCallback((title: string, trace: AiTracePayload) => {
    const fallbackResponse = trace.assistant_excerpt || (trace.summary ? `[trace] ${trace.summary}` : undefined)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        at: Date.now(),
        title,
        summary: trace.summary,
        promptKey: trace.llm_request || trace.key_prompt,
        response: fallbackResponse,
      },
    ])
  }, [])

  const pushNote = useCallback((title: string, body: string) => {
    setMessages((prev) => [...prev, { id: uid(), at: Date.now(), title, summary: body }])
  }, [])

  const clear = useCallback(() => setMessages([]), [])

  const value = useMemo(
    () => ({
      messages,
      activeOp,
      startOperation,
      appendLiveResponse,
      setLiveResponse,
      appendLiveReasoning,
      endOperation,
      pushTrace,
      pushNote,
      clear,
    }),
    [messages, activeOp, startOperation, appendLiveResponse, setLiveResponse, appendLiveReasoning, endOperation, pushTrace, pushNote, clear],
  )

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
}

export function useAiChat() {
  const ctx = useContext(AiChatContext)
  if (!ctx) throw new Error('useAiChat must be used within AiChatProvider')
  return ctx
}
