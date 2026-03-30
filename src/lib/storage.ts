import { AppState } from '../types'

const STORAGE_KEY = 'resume-maker-state'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    return { ...defaultState(), ...parsed }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export async function loadStateFromServer(): Promise<AppState | null> {
  try {
    const res = await fetch('/api/data')
    if (!res.ok) return null
    const data = await res.json() as Partial<AppState>
    return { ...defaultState(), ...data }
  } catch {
    return null
  }
}

export async function saveStateToServer(state: AppState): Promise<void> {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
  } catch {
    // ignore — localStorage still has the data
  }
}

export async function gitPush(): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/git-push', { method: 'POST' })
    return await res.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network error' }
  }
}

function defaultState(): AppState {
  return {
    questions: [],
    selectedQuestionId: null,
    globalContext: '',
  }
}
