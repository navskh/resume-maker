import type { SkillInfo, Suggestion } from '../types'

export async function fetchSkills(): Promise<SkillInfo[]> {
  try {
    const res = await fetch('/api/skills')
    return await res.json() as SkillInfo[]
  } catch {
    return []
  }
}

export async function fetchHighlights(
  content: string,
  globalContext?: string,
): Promise<Suggestion[]> {
  try {
    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, globalContext }),
    })
    const data = await res.json() as { suggestions?: Suggestion[] }
    return data.suggestions ?? []
  } catch {
    return []
  }
}

export async function getClaudeReview(
  question: string,
  content: string,
  skillId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  globalContext?: string,
) {
  try {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, content, skillId, globalContext }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value).split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') { onDone(); return }
        try {
          const parsed = JSON.parse(data) as { text?: string; error?: string }
          if (parsed.error) { onError(parsed.error); return }
          if (parsed.text) onChunk(parsed.text)
        } catch { /* ignore parse errors */ }
      }
    }
    onDone()
  } catch (err) {
    onError(err instanceof Error ? err.message : '서버 연결 오류')
  }
}
