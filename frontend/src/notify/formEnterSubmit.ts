import type { KeyboardEvent } from 'react'

const NON_ENTER_SUBMIT_INPUT_TYPES = new Set([
  'submit',
  'button',
  'reset',
  'checkbox',
  'radio',
  'file',
  'hidden',
  'image',
])

/** Single-line text-like inputs where Enter should submit the owning form. */
export function isSingleLineTextInput(el: HTMLInputElement): boolean {
  return !NON_ENTER_SUBMIT_INPUT_TYPES.has(el.type)
}

/**
 * Form `onKeyDown`: Enter in a single-line `<input>` submits the form (like clicking the primary submit control).
 * Skips `<textarea>`, tag chips (custom Enter behavior), and inputs that already called `preventDefault`.
 */
export function handleFormEnterToSubmitKeyDown(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.defaultPrevented) return
  const t = e.target
  if (!(t instanceof HTMLInputElement)) return
  if (!isSingleLineTextInput(t)) return
  if (t.closest('.tag-chips-input')) return
  e.preventDefault()
  e.currentTarget.requestSubmit()
}
