import { loadSettings } from '../settings/settingsStorage'

export type NotifyPayload = {
  kind: 'success' | 'error' | 'info'
  title: string
  body?: string
}

export type NotifyHandler = (payload: NotifyPayload) => void

let customHandler: NotifyHandler | null = null

/**
 * Route all notifications through a custom UI (e.g. in-app toasts).
 * When set, browser Notification API is not used.
 */
export function setNotifyHandler(handler: NotifyHandler | null) {
  customHandler = handler
}

export function notifySuccess(title: string, body?: string) {
  dispatch({ kind: 'success', title, body })
}

export function notifyError(title: string, body?: string) {
  dispatch({ kind: 'error', title, body })
}

export function notifyInfo(title: string, body?: string) {
  dispatch({ kind: 'info', title, body })
}

function dispatch(payload: NotifyPayload) {
  if (customHandler) {
    customHandler(payload)
    return
  }
  void showBrowserNotification(payload)
}

async function showBrowserNotification(p: NotifyPayload) {
  if (typeof window === 'undefined') return
  if (!loadSettings().useBrowserNotifications) {
    console.info(`[notify:${p.kind}] ${p.title}`, p.body ?? '')
    return
  }
  if (!('Notification' in window)) {
    console.info(`[notify:${p.kind}] ${p.title}`, p.body ?? '')
    return
  }
  let perm = Notification.permission
  if (perm === 'default') {
    perm = await Notification.requestPermission()
  }
  if (perm !== 'granted') {
    console.info(`[notify:${p.kind}] ${p.title}`, p.body ?? '')
    return
  }
  try {
    new Notification(p.title, { body: p.body })
  } catch {
    console.info(`[notify:${p.kind}] ${p.title}`, p.body ?? '')
  }
}
