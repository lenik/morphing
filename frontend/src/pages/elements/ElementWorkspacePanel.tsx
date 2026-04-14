import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addComment,
  completeSlotsStream,
  fetchComments,
  fetchElement,
  fetchVotes,
  loadSubgraph,
  patchElement,
  uploadElementIcon,
  upsertVote,
} from '../../api/client'
import type { Comment, Element, Vote } from '../../api/types'
import { CollectionGallery } from '../../components/CollectionGallery'
import { RefactorPlanModal } from '../../components/RefactorPlanModal'
import { ElementTypeChrome } from '../../components/ElementTypeChrome'
import { GraphNavPanels } from '../../components/GraphNavPanels'
import { ElementSlotForm } from '../../components/ElementSlotForm'
import { TagChipsInput } from '../../components/TagChipsInput'
import { UPSTREAM_IDS_KEY, UpstreamElementsField } from '../../components/UpstreamElementsField'
import {
  IconAlignLeft,
  IconAlertTriangle,
  IconArrowLeft,
  IconGitBranch,
  IconHistory,
  IconMessageSquare,
  IconNetwork,
  IconRefreshCw,
  IconSave,
  IconSend,
  IconTag,
  IconThumbsDown,
  IconThumbsUp,
  IconFileText,
  IconUser,
  IconUserCircle,
  IconX,
  IconZap,
} from '../../components/ui/icons'
import { useAiChat } from '../../context/AiChatContext'
import { useElementsData } from '../../context/ElementsDataContext'
import { handleFormEnterToSubmitKeyDown, notifyInfo, notifySuccess } from '../../notify'
import { loadSettings } from '../../settings/settingsStorage'
import {
  getSlotsMap,
  getViewConfig,
  mergeSlotsForType,
} from '../../domain/elementSlots'
import { getElementTier } from '../../domain/elementTier'

export function ElementWorkspacePanel() {
  const { id } = useParams<{ id: string }>()
  const { upsertElement, elements } = useElementsData()
  const { startOperation, appendLiveResponse, appendLiveReasoning, setLiveResponse, endOperation, pushTrace, pushNote } = useAiChat()
  const elementsById = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements])
  const [element, setElement] = useState<Element | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [memberAddInput, setMemberAddInput] = useState('')
  const [refactorOpen, setRefactorOpen] = useState(false)
  const [refactorPlan, setRefactorPlan] = useState<{ id: string; title: string; type_hint: string }[]>([])
  const [refactorIdx, setRefactorIdx] = useState(0)
  const [refactorRun, setRefactorRun] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const voterId = 'local-user'

  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('Idea')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editAuthor, setEditAuthor] = useState('')
  const [editMetadata, setEditMetadata] = useState<Record<string, unknown>>({})
  const [aiSlotChanges, setAiSlotChanges] = useState<Record<string, { oldValue: string; newValue: string }>>({})
  const [aiTitleChange, setAiTitleChange] = useState<{ oldValue: string; newValue: string } | null>(null)
  const [activeAiField, setActiveAiField] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setError(null)
    Promise.all([fetchElement(id), fetchComments(id), fetchVotes(id)])
      .then(([el, cm, vo]) => {
        if (!cancelled) {
          setElement(el)
          setComments(cm)
          setVotes(vo)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!element) return
    setEditTitle(element.title)
    setEditType(element.type_hint)
    setEditContent(element.content)
    setEditTags([...element.tags])
    setEditAuthor(element.author)
    setEditMetadata({ ...(element.metadata || {}) })
    setAiSlotChanges({})
    setAiTitleChange(null)
    setActiveAiField(null)
  }, [element])

  const upstreamIds = useMemo(() => {
    const raw = editMetadata[UPSTREAM_IDS_KEY]
    if (!Array.isArray(raw)) return []
    return raw.filter((x): x is string => typeof x === 'string')
  }, [editMetadata])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const c = await addComment(id, commentAuthor, commentBody)
    setComments((prev) => [...prev, c])
    setCommentBody('')
  }

  function buildMetadataPayload() {
    const slotsMerged = mergeSlotsForType(editType, getSlotsMap(editMetadata))
    return { ...editMetadata, slots: slotsMerged }
  }

  async function saveElement(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaveError(null)
    setSaving(true)
    try {
      const tags = [...editTags]
      const metadataPayload = buildMetadataPayload()
      const updated = await patchElement(id, {
        title: editTitle.trim(),
        type_hint: editType,
        content: editContent,
        tags,
        author: editAuthor.trim(),
        metadata: metadataPayload,
      })
      setElement(updated)
      upsertElement(updated)
      void notifySuccess('Element saved', updated.title)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function runRefactor() {
    if (!id || saving || refactorRun) return
    setSaveError(null)
    setSaving(true)
    startOperation(
      'Refactor (demo)',
      'Saving your edits, then loading downstream graph nodes to build the refactor walkthrough.',
    )
    try {
      const tags = [...editTags]
      const metadataPayload = buildMetadataPayload()
      const updated = await patchElement(id, {
        title: editTitle.trim(),
        type_hint: editType,
        content: editContent,
        tags,
        author: editAuthor.trim(),
        metadata: metadataPayload,
      })
      setElement(updated)
      upsertElement(updated)
      void notifySuccess('Saved', updated.title)

      const sg = await loadSubgraph(id, 24, 'downstream')
      const nodes = sg.nodes.filter((n) => n.id !== id)
      nodes.sort((a, b) => {
        const ta = getElementTier(a.type_hint)
        const tb = getElementTier(b.type_hint)
        if (ta !== tb) return ta - tb
        return (a.title || '').localeCompare(b.title || '')
      })
      setRefactorPlan(nodes.map((n) => ({ id: n.id, title: n.title, type_hint: n.type_hint })))
      setRefactorIdx(0)
      setRefactorOpen(true)
      setRefactorRun(true)
      pushNote(
        'Refactor (demo)',
        `Found ${nodes.length} downstream element(s). The modal steps through them; this prototype does not call downstream AI rewrites — only a UI preview.`,
      )
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      endOperation()
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!refactorOpen || !refactorRun) return
    const n = refactorPlan.length
    if (n === 0) {
      setRefactorRun(false)
      void notifyInfo('Refactor plan', 'No downstream elements in the graph.')
      return
    }
    if (refactorIdx >= n) {
      setRefactorRun(false)
      void notifyInfo('Refactor preview', 'Demo run finished (no downstream AI calls).')
      return
    }
    const t = window.setTimeout(() => setRefactorIdx((x) => x + 1), 520)
    return () => window.clearTimeout(t)
  }, [refactorOpen, refactorRun, refactorIdx, refactorPlan])

  async function vote(value: -1 | 1) {
    if (!id) return
    await upsertVote(id, voterId, value)
    setVotes(await fetchVotes(id))
  }

  async function clearVote() {
    if (!id) return
    await upsertVote(id, voterId, 0)
    setVotes(await fetchVotes(id))
  }

  async function onIconFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id) return
    setSaveError(null)
    try {
      const el = await uploadElementIcon(id, file)
      setElement(el)
      setEditMetadata({ ...(el.metadata || {}) })
      upsertElement(el)
    } catch (err) {
      setSaveError((err as Error).message)
    }
  }

  if (!id) return <p>Missing id</p>
  if (error) return <p className="error">{error}</p>
  if (!element) {
    return (
      <p className="muted icon-label">
        <IconRefreshCw size={14} />
        <span>Loading…</span>
      </p>
    )
  }

  const score = votes.reduce((s, v) => s + v.value, 0)
  const meta = element.metadata as Record<string, unknown>
  const outdated = Boolean(meta?.outdated)
  const viewCfg = getViewConfig(editType)
  const slotValues = mergeSlotsForType(editType, getSlotsMap(editMetadata)) as Record<string, string>
  const draftElement: Element = {
    ...element,
    metadata: editMetadata as Element['metadata'],
    type_hint: editType,
  }

  function onSlotChange(key: string, value: string) {
    setEditMetadata((prev) => ({
      ...prev,
      slots: {
        ...mergeSlotsForType(editType, getSlotsMap(prev)),
        [key]: value,
      },
    }))
  }

  function onSlotDelete(key: string) {
    setEditMetadata((prev) => {
      const merged = { ...mergeSlotsForType(editType, getSlotsMap(prev)) }
      delete merged[key]
      return { ...prev, slots: merged }
    })
  }

  function onShotOrderChange(v: string) {
    setEditMetadata((prev) => {
      const next = { ...prev }
      const n = parseInt(v.trim(), 10)
      if (v.trim() === '' || !Number.isFinite(n)) {
        delete next.order
      } else {
        next.order = n
      }
      return next
    })
  }

  async function runAiComplete() {
    setSaveError(null)
    setAiLoading(true)
    setAiSlotChanges({})
    setAiTitleChange(null)
    const s = loadSettings()
    const llmRequestPayload = JSON.stringify(
      {
        url: `${(s.openaiApiBaseUrl || '').replace(/\/+$/, '')}/chat/completions`,
        headers: {
          Authorization: 'Bearer <OPENAI_API_KEY>',
          'Content-Type': 'application/json',
        },
        body: {
          model: s.openaiDefaultModel || 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `[Slot fill] type=${editType}\n[Title] ${editTitle}\n[Body]\n${editContent}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.25,
          top_p: 0.9,
          stream: true,
          reasoning_effort: 'none',
        },
      },
      null,
      2,
    )
    const keyPrompt = s.showCompleteRequestMessageToLlm
      ? llmRequestPayload
      : `[Slot fill] type=${editType}
[Title] ${editTitle}
[Body excerpt, ${editContent.length} chars total]
${editContent.slice(0, 500)}`
    startOperation(
      'AI Complete',
      'Calling the model to fill structured metadata slots for this element type (may take up to ~2 minutes).',
      keyPrompt,
    )
    const simpleMode = !s.showCompleteRequestMessageToLlm
    const slotLabelByKey = new Map(getViewConfig(editType).slots.map((f) => [f.key, f.label]))
    const parsedShown = new Map<string, string>()
    let rawStream = ''
    const baseTitle = editTitle
    const baseSlots = { ...slotValues }
    let lastApplied: Record<string, string> = {}

    const focusField = (key: string) => {
      setActiveAiField(key)
      window.setTimeout(() => {
        if (key === 'title') {
          const el = titleInputRef.current
          if (!el) return
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          el.focus()
          return
        }
        const target = document.querySelector(`[data-ai-field="slot:${key}"] input, [data-ai-field="slot:${key}"] textarea`) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null
        if (!target) return
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        target.focus()
      }, 0)
    }

    const applyLiveField = (key: string, val: string) => {
      if (!val.trim()) return
      if (key === 'title') {
        setEditTitle(val)
        if (val !== baseTitle) setAiTitleChange({ oldValue: baseTitle, newValue: val })
        else setAiTitleChange(null)
        focusField('title')
        return
      }
      setEditMetadata((prev) => ({
        ...prev,
        slots: {
          ...mergeSlotsForType(editType, getSlotsMap(prev)),
          [key]: val,
        },
      }))
      if (val !== (baseSlots[key] || '')) {
        setAiSlotChanges((prev) => ({ ...prev, [key]: { oldValue: baseSlots[key] || '', newValue: val } }))
      } else {
        setAiSlotChanges((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
      focusField(key)
    }

    const updateSimpleLiveFromRaw = (chunk: string) => {
      rawStream += chunk
      const patternObject = /"([a-zA-Z0-9_]+)"\s*:\s*\{\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"/g
      const patternPlain = /"([a-zA-Z0-9_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g
      const extracted: Record<string, string> = {}
      const consume = (re: RegExp) => {
        let m: RegExpExecArray | null
        while ((m = re.exec(rawStream)) != null) {
          const key = m[1]
          if (key === 'extra_slots' || key === 'slots' || key === 'confidence') continue
          const val = m[2].replace(/\\"/g, '"').trim()
          if (!val) continue
          extracted[key] = val
        }
      }
      consume(patternObject)
      consume(patternPlain)
      for (const [k, v] of Object.entries(extracted)) {
        if (lastApplied[k] !== v) {
          lastApplied[k] = v
          applyLiveField(k, v)
        }
        parsedShown.set(k, v)
      }
      const shown = [...parsedShown.entries()]
        .map(([k, v]) => `${slotLabelByKey.get(k) || k}: ${v}`)
        .join('\n')
      if (shown) setLiveResponse(shown)
    }
    try {
      const { accepted_slots, accepted_extra_slots, accepted_title, accepted_body, applied_threshold, ai_trace } = await completeSlotsStream({
        title: editTitle,
        type_hint: editType,
        content: editContent,
        openai_api_key: s.openaiApiKey || undefined,
        openai_base_url: s.openaiApiBaseUrl || undefined,
        model: s.openaiDefaultModel || undefined,
        accept_confidence: s.aiCompletionAcceptConfidence,
        allow_custom_facets: true,
        show_complete_request_to_llm: s.showCompleteRequestMessageToLlm,
        locale: s.locale,
      }, {
        onDelta: (text) => {
          if (simpleMode) updateSimpleLiveFromRaw(text)
          else appendLiveResponse(text)
        },
        onReasoning: (text) => appendLiveReasoning(text),
        onErrorEvent: (message) => setLiveResponse(`[stream warning] ${message}`),
      })
      setEditMetadata((prev) => ({
        ...prev,
        slots: {
          ...mergeSlotsForType(editType, getSlotsMap(prev)),
          ...accepted_slots,
          ...accepted_extra_slots,
        },
      }))
      if (accepted_title?.trim()) {
        setEditTitle(accepted_title.trim())
        if (accepted_title.trim() !== baseTitle) setAiTitleChange({ oldValue: baseTitle, newValue: accepted_title.trim() })
      }
      if (!editContent.trim() && accepted_body?.trim()) {
        setEditContent(accepted_body.trim())
      }
      pushTrace(
        'AI Complete',
        {
          ...ai_trace,
          assistant_excerpt: simpleMode
            ? Object.entries({ ...accepted_slots, ...accepted_extra_slots })
              .map(([k, v]) => `${slotLabelByKey.get(k) || k}: ${v}`)
              .join('\n')
            : ai_trace.assistant_excerpt,
          llm_request: ai_trace.llm_request || (s.showCompleteRequestMessageToLlm ? llmRequestPayload : undefined),
          summary: `${ai_trace.summary || ''} · applied>=${applied_threshold.toFixed(2)}`.trim(),
        },
      )
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      endOperation()
      setAiLoading(false)
    }
  }

  function undoAiSlotChange(key: string) {
    const change = aiSlotChanges[key]
    if (!change) return
    onSlotChange(key, change.oldValue)
    setAiSlotChanges((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function undoAiTitleChange() {
    if (!aiTitleChange) return
    setEditTitle(aiTitleChange.oldValue)
    setAiTitleChange(null)
  }

  function removeCollectionMember(mid: string) {
    setEditMetadata((prev) => {
      const raw = prev.collection_member_ids
      const arr = Array.isArray(raw) ? [...raw].filter((x): x is string => typeof x === 'string') : []
      return { ...prev, collection_member_ids: arr.filter((x) => x !== mid) }
    })
  }

  function addCollectionMember() {
    const v = memberAddInput.trim()
    if (!v) return
    setEditMetadata((prev) => {
      const raw = prev.collection_member_ids
      const arr = Array.isArray(raw) ? [...raw].filter((x): x is string => typeof x === 'string') : []
      if (arr.includes(v)) return prev
      return { ...prev, collection_member_ids: [...arr, v] }
    })
    setMemberAddInput('')
  }

  const collectionMemberIds = Array.isArray(editMetadata.collection_member_ids)
    ? (editMetadata.collection_member_ids as string[])
    : []

  return (
    <div className="elements-main-panel elements-main-panel--editor">
      <header className="elements-main-panel__head">
        <h2 className="elements-main-panel__title icon-label">
          <IconAlignLeft size={20} />
          <span>View / edit</span>
        </h2>
        <Link to="/elements" className="elements-main-panel__back icon-label">
          <IconArrowLeft size={16} />
          <span>Back</span>
        </Link>
      </header>

      <ElementTypeChrome element={element} elementId={id} />

      <div className="element-icon-panel icon-label">
        {(element.metadata as Record<string, unknown>)?.icon_thumb_url ? (
          <img
            src={String((element.metadata as Record<string, unknown>).icon_thumb_url)}
            alt=""
            width={40}
            height={40}
            className="element-icon-panel__thumb"
          />
        ) : null}
        <label className="element-icon-panel__upload">
          <IconFileText size={16} />
          <span>Upload icon</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onIconFileChange(e)} />
        </label>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Server stores full image plus a small PNG thumbnail; the navigator uses the thumbnail only.
        </span>
      </div>

      {outdated ? (
        <p className="error icon-label" style={{ marginTop: '0.75rem' }}>
          <IconAlertTriangle size={16} />
          <span>Marked outdated (upstream changed).</span>
        </p>
      ) : null}

      <section className="create-panel element-editor" style={{ marginTop: '1rem' }}>
        <div className="element-editor__fixed-actions" role="toolbar" aria-label="Save and graph">
          <Link
            to={`/graph?root=${encodeURIComponent(id)}&analyze=1`}
            className="element-editor__graph-link icon-label"
            title="Open narrative graph and run analysis"
          >
            <IconNetwork size={15} />
            <span>Graph</span>
          </Link>
          <button
            type="button"
            className="element-editor__refactor icon-label"
            disabled={saving || refactorRun}
            title="Save, then show downstream refactor plan (demo progress)"
            onClick={() => void runRefactor()}
          >
            <IconRefreshCw size={15} />
            <span>Refactor</span>
          </button>
          <button
            type="submit"
            form="element-edit-form"
            className="element-editor__save icon-label"
            disabled={saving}
          >
            <IconSave size={16} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="element-editor__head">
          <h3 className="elements-main-panel__sub icon-label element-editor__head-title">
            <IconAlignLeft size={18} />
            <span>Content</span>
          </h3>
          <span className="element-editor__head-placeholder" aria-hidden />
        </div>
        <form
          id="element-edit-form"
          className="create-form element-editor__form"
          onKeyDown={handleFormEnterToSubmitKeyDown}
          onSubmit={(e) => void saveElement(e)}
        >
          <div className="create-form__row element-editor__title-ai create-form__span-2">
            <label className="create-form__field element-editor__field-title">
              <span className="icon-label">
                <IconAlignLeft size={14} />
                Title
              </span>
              <div className="create-form__field-head">
                <input
                  ref={titleInputRef}
                  required
                  className={activeAiField === 'title' ? 'create-form__field--ai-focus-input' : ''}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                {aiTitleChange ? (
                  <button type="button" className="create-form__undo" onClick={undoAiTitleChange} title="Undo AI title change">
                    <IconRefreshCw size={12} />
                  </button>
                ) : null}
              </div>
              {aiTitleChange ? <small className="create-form__old-value">Old: {aiTitleChange.oldValue || '(empty)'}</small> : null}
            </label>
            <div className="element-editor__ai-actions">
              <button
                type="button"
                className="element-editor__ai-btn"
                disabled={aiLoading || saving}
                onClick={() => void runAiComplete()}
              >
                {aiLoading ? 'Working…' : 'AI Complete'}
              </button>
            </div>
          </div>
          <label className="create-form__field create-form__field--tags create-form__span-2">
            <span className="icon-label">
              <IconTag size={14} />
              Tags
            </span>
            <TagChipsInput
              key={element.id}
              id={`edit-tags-${element.id}`}
              tags={editTags}
              onChange={setEditTags}
              placeholder="Type a word, Space to add; Backspace removes last tag"
            />
          </label>
          <UpstreamElementsField
            currentElementId={id}
            currentTypeHint={editType}
            elements={elements}
            value={upstreamIds}
            onChange={(ids) => setEditMetadata((prev) => ({ ...prev, [UPSTREAM_IDS_KEY]: ids }))}
          />
          {editType === 'Collection' ? (
            <div className="create-form__span-2 collection-members-panel">
              <h4 className="collection-members-panel__head">Members in this collection</h4>
              <ul className="collection-members-panel__list">
                {collectionMemberIds.map((mid) => (
                  <li key={mid} className="collection-members-panel__item">
                    <Link to={`/elements/${mid}`} className="collection-members-panel__link">
                      {elementsById.get(mid)?.title ?? mid}
                    </Link>
                    <button type="button" className="collection-members-panel__remove" onClick={() => removeCollectionMember(mid)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="collection-members-panel__add">
                <input
                  value={memberAddInput}
                  onChange={(e) => setMemberAddInput(e.target.value)}
                  placeholder="Element id to add"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCollectionMember()
                    }
                  }}
                />
                <button type="button" className="button-secondary" onClick={addCollectionMember}>
                  Add member
                </button>
              </div>
            </div>
          ) : null}
          <label className="create-form__field create-form__span-2">
            <span>{viewCfg.contentLabel}</span>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={14}
              placeholder={viewCfg.contentPlaceholder}
            />
          </label>
          <div className="create-form__span-2">
            <ElementSlotForm
              typeHint={editType}
              element={draftElement}
              slotValues={slotValues}
              onSlotChange={onSlotChange}
              onSlotDelete={onSlotDelete}
              aiChanges={aiSlotChanges}
              onUndoAiChange={undoAiSlotChange}
              activeAiField={activeAiField}
              shotOrder={editType === 'Shot' ? String(editMetadata.order ?? '') : ''}
              onShotOrderChange={onShotOrderChange}
            />
          </div>
          <div className="create-form__row create-form__row--block">
            <label className="create-form__field">
              <span className="icon-label">
                <IconUser size={14} />
                Author
              </span>
              <input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            </label>
          </div>
          {saveError ? <p className="error create-form__span-2">{saveError}</p> : null}
        </form>
      </section>

      <RefactorPlanModal
        open={refactorOpen}
        items={refactorPlan}
        progressIndex={refactorIdx}
        running={refactorRun}
        onClose={() => {
          setRefactorOpen(false)
          setRefactorRun(false)
        }}
      />

      <CollectionGallery currentElementId={id} author={editAuthor} />

      <p className="muted icon-label" style={{ marginTop: '1rem' }}>
        <IconHistory size={14} />
        <span>
          v{element.version} · id <code style={{ fontSize: '0.8em' }}>{element.id}</code>
        </span>
      </p>

      <p className="row link-row" style={{ gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <Link to={`/dependencies/${id}`} className="icon-label">
          <IconGitBranch size={14} />
          <span>Dependencies</span>
        </Link>
        <Link to={`/versions/${id}`} className="icon-label">
          <IconHistory size={14} />
          <span>Versions</span>
        </Link>
        <Link to={`/morph/${id}`} className="icon-label">
          <IconZap size={14} />
          <span>Morph</span>
        </Link>
        {element.author ? (
          <Link to={`/creators/${encodeURIComponent(element.author)}`} className="icon-label">
            <IconUserCircle size={14} />
            <span>Creator</span>
          </Link>
        ) : null}
      </p>

      <GraphNavPanels elementId={id} />

      <section className="section">
        <h3 className="icon-label">
          <IconThumbsUp size={18} />
          <span>Votes</span>
        </h3>
        <p className="icon-label">
          <IconThumbsUp size={14} />
          <span>
            Score: <strong>{score}</strong>
          </span>
        </p>
        <div className="row">
          <button type="button" className="icon-label" onClick={() => void vote(1)}>
            <IconThumbsUp size={16} />
            Upvote
          </button>
          <button type="button" className="icon-label" onClick={() => void vote(-1)}>
            <IconThumbsDown size={16} />
            Downvote
          </button>
          <button type="button" className="icon-label" onClick={() => void clearVote()}>
            <IconX size={16} />
            Clear mine
          </button>
        </div>
      </section>

      <section className="section">
        <h3 className="icon-label">
          <IconMessageSquare size={18} />
          <span>Comments</span>
        </h3>
        <ul className="comments">
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.author || 'anon'}</strong>: {c.body}
            </li>
          ))}
          {comments.length === 0 ? <li className="muted">No comments yet.</li> : null}
        </ul>
        <form
          onKeyDown={handleFormEnterToSubmitKeyDown}
          onSubmit={(e) => void submitComment(e)}
          className="form"
        >
          <label className="icon-label">
            <IconUser size={14} />
            Name
            <input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} />
          </label>
          <label className="icon-label">
            <IconMessageSquare size={14} />
            Comment
            <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3} />
          </label>
          <button type="submit" className="icon-label">
            <IconSend size={16} />
            Send
          </button>
        </form>
      </section>
    </div>
  )
}
