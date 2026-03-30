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

function defaultState(): AppState {
  return {
    questions: [],
    selectedQuestionId: null,
    globalContext: '',
  }
}
