import express from 'express'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { skills, getSkill } from './server/skills.js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'

const app = express()
app.use(express.json({ limit: '10mb' }))

const DATA_FILE = resolve('./data/resume-data.json')

app.get('/api/data', (_req, res) => {
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8')
    res.json(JSON.parse(raw))
  } catch {
    res.json({ questions: [], selectedQuestionId: null, globalContext: '' })
  }
})

app.post('/api/data', (req, res) => {
  try {
    mkdirSync('./data', { recursive: true })
    writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'write failed' })
  }
})

app.post('/api/git-push', (_req, res) => {
  try {
    execSync('git add data/resume-data.json', { cwd: resolve('.') })
    const msg = `chore: backup resume data ${new Date().toLocaleString('ko-KR')}`
    execSync(`git commit -m "${msg}"`, { cwd: resolve('.') })
    execSync('git push', { cwd: resolve('.') })
    res.json({ ok: true, message: 'GitHub에 백업 완료!' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git push failed'
    // If nothing to commit, that's fine
    if (msg.includes('nothing to commit')) {
      res.json({ ok: true, message: '변경사항이 없습니다.' })
    } else {
      res.status(500).json({ error: msg })
    }
  }
})

app.get('/api/skills', (_req, res) => {
  res.json(skills.map(({ id, name, description }) => ({ id, name, description })))
})

app.post('/api/review', async (req: express.Request, res: express.Response) => {
  const { question, content, skillId, globalContext } = req.body as {
    question: string
    content: string
    skillId?: string
    globalContext?: string
  }

  const skill = getSkill(skillId ?? 'general')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const prompt = skill.promptTemplate(question, content, globalContext)

  try {
    let resultText = ''
    for await (const message of query({
      prompt,
      options: {
        allowedTools: [],
        systemPrompt: skill.systemPrompt,
      },
    })) {
      if ('result' in message && typeof (message as { result: string }).result === 'string') {
        resultText = (message as { result: string }).result
      }
    }
    res.write(`data: ${JSON.stringify({ text: resultText })}\n\n`)
    res.write('data: [DONE]\n\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '오류가 발생했습니다'
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  }
  res.end()
})

app.post('/api/highlights', async (req: express.Request, res: express.Response) => {
  const { content, globalContext } = req.body as { content: string; globalContext?: string }

  const contextLine = globalContext ? `\n지원 배경: ${globalContext}\n` : ''

  const prompt = `당신은 텍스트 교정 전문가입니다.${contextLine}
아래 자기소개서에서 수정이 필요한 구절을 찾아 JSON 배열만 반환하세요. 다른 텍스트는 절대 포함하지 마세요.

형식:
[{"original":"원문의 정확한 구절","replacement":"개선된 구절","reason":"이유(15자이내)"}]

규칙:
- original은 원문에 그대로 존재하는 텍스트만
- 3-6개 제안
- 전체 문장보다 핵심 구절 위주

원문:
${content}`

  try {
    let resultText = ''
    for await (const message of query({ prompt, options: { allowedTools: [] } })) {
      if ('result' in message && typeof (message as { result: string }).result === 'string') {
        resultText = (message as { result: string }).result
      }
    }
    let suggestions = []
    try {
      suggestions = JSON.parse(resultText)
    } catch {
      const match = resultText.match(/\[[\s\S]*\]/)
      if (match) {
        try { suggestions = JSON.parse(match[0]) } catch { /* ignore */ }
      }
    }
    res.json({ suggestions })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`✅ 첨삭 서버 실행 중: http://localhost:${PORT}`)
})
