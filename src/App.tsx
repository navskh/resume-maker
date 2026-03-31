import { useState, useEffect, useCallback, useRef } from 'react'
import MarkdownReview from './components/MarkdownReview'
import HighlightedText from './components/HighlightedText'
import WordMapPopup from './components/WordMapPopup'
import { v4 as uuidv4 } from 'uuid'
import { AppState, Question, Version, SkillInfo, Suggestion, WordMapResult } from './types'
import { loadState, saveState, loadStateFromServer, saveStateToServer, gitPush } from './lib/storage'
import { getClaudeReview, fetchSkills, fetchHighlights, fetchWordMap } from './lib/claude'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState('general')
  const [showContext, setShowContext] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showHighlights, setShowHighlights] = useState(false)
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false)
  const [showReviewPanel, setShowReviewPanel] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [isPushing, setIsPushing] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [wordMapSelection, setWordMapSelection] = useState<{ start: number; end: number; word: string } | null>(null)
  const [wordMapResult, setWordMapResult] = useState<WordMapResult | null>(null)
  const [wordMapLoading, setWordMapLoading] = useState(false)
  const [wordMapPosition, setWordMapPosition] = useState({ top: 0, left: 0, maxWidth: 400 })
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const selectedQuestion = state.questions.find(q => q.id === state.selectedQuestionId) ?? null

  // Sync editor content when selected question changes
  useEffect(() => {
    if (selectedQuestion) {
      const activeVersion = selectedQuestion.versions.find(v => v.id === selectedQuestion.activeVersionId)
      setEditorContent(activeVersion?.content ?? '')
    } else {
      setEditorContent('')
    }
    setReviewText('')
    setReviewError('')
    setReviewFeedback('')
    setShowReviewPanel(false)
    setSuggestions([])
    setShowHighlights(false)
  }, [state.selectedQuestionId])

  // Load from server on startup (overrides localStorage if server has data)
  useEffect(() => {
    loadStateFromServer().then(serverState => {
      if (serverState && serverState.questions.length > 0) {
        setState(serverState)
        saveState(serverState)
      }
    })
  }, [])

  // Save state on change (localStorage + debounced server sync)
  useEffect(() => {
    saveState(state)
    const timer = setTimeout(() => saveStateToServer(state), 1000)
    return () => clearTimeout(timer)
  }, [state])

  // Load skills
  useEffect(() => {
    fetchSkills().then(setSkills)
  }, [])

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev)
      return next
    })
  }, [])

  function addQuestion() {
    const newQ: Question = {
      id: uuidv4(),
      title: '새 문항',
      maxChars: 1000,
      versions: [],
      activeVersionId: null,
    }
    updateState(prev => ({
      ...prev,
      questions: [...prev.questions, newQ],
      selectedQuestionId: newQ.id,
    }))
  }

  function deleteQuestion(id: string) {
    updateState(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id),
      selectedQuestionId: prev.selectedQuestionId === id
        ? (prev.questions.find(q => q.id !== id)?.id ?? null)
        : prev.selectedQuestionId,
    }))
  }

  function updateQuestionTitle(id: string, title: string) {
    updateState(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, title } : q),
    }))
  }

  function updateMaxChars(id: string, value: string) {
    const num = value === '' ? null : parseInt(value, 10)
    if (value !== '' && (isNaN(num!) || num! < 0)) return
    updateState(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, maxChars: num } : q),
    }))
  }

  function saveVersion(label?: string) {
    if (!selectedQuestion) return
    const newVersion: Version = {
      id: uuidv4(),
      content: editorContent,
      createdAt: new Date().toISOString(),
      label: label || `버전 ${selectedQuestion.versions.length + 1}`,
      charCount: editorContent.length,
    }
    updateState(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === selectedQuestion.id
          ? { ...q, versions: [...q.versions, newVersion], activeVersionId: newVersion.id }
          : q
      ),
    }))
  }

  function loadVersion(versionId: string) {
    if (!selectedQuestion) return
    const version = selectedQuestion.versions.find(v => v.id === versionId)
    if (!version) return
    setEditorContent(version.content)
    updateState(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === selectedQuestion.id ? { ...q, activeVersionId: versionId } : q
      ),
    }))
  }

  function deleteVersion(versionId: string) {
    if (!selectedQuestion) return
    updateState(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id !== selectedQuestion.id) return q
        const remaining = q.versions.filter(v => v.id !== versionId)
        const newActiveId = q.activeVersionId === versionId
          ? (remaining[remaining.length - 1]?.id ?? null)
          : q.activeVersionId
        return { ...q, versions: remaining, activeVersionId: newActiveId }
      }),
    }))
  }

  async function handleReview(feedback?: string, previousReview?: string) {
    if (!selectedQuestion || !editorContent.trim()) return
    setIsReviewing(true)
    setShowReviewPanel(true)
    setReviewText('')
    setReviewError('')
    await getClaudeReview(
      selectedQuestion.title,
      editorContent,
      selectedSkillId,
      (chunk) => setReviewText(prev => prev + chunk),
      () => { setIsReviewing(false); setReviewFeedback('') },
      (err) => { setReviewError(err); setIsReviewing(false) },
      state.globalContext,
      feedback,
      previousReview,
    )
  }

  async function handleFetchHighlights() {
    if (!editorContent.trim()) return
    setIsLoadingHighlights(true)
    setSuggestions([])
    setShowHighlights(true)
    const result = await fetchHighlights(editorContent, state.globalContext)
    setSuggestions(result)
    setIsLoadingHighlights(false)
  }

  async function handleGitPush() {
    setIsPushing(true)
    setPushMessage('')
    const result = await gitPush()
    setIsPushing(false)
    setPushMessage(result.message ?? result.error ?? '')
    setTimeout(() => setPushMessage(''), 4000)
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      if (start === end) return
      const selected = textarea.value.slice(start, end).trim()
      if (!selected) return

      // Calculate popup position using viewport coordinates (fixed positioning)
      const textareaRect = textarea.getBoundingClientRect()
      const popupWidth = Math.min(textareaRect.width * 0.6, 480)
      const left = textareaRect.left + (textareaRect.width - popupWidth) / 2
      // Show below textarea top + some offset, but ensure it doesn't go off-screen bottom
      const spaceBelow = window.innerHeight - textareaRect.top - 60
      const top = spaceBelow > 300
        ? textareaRect.top + 60
        : textareaRect.top - 320
      const maxWidth = popupWidth

      setWordMapPosition({ top, left, maxWidth })
      setWordMapSelection({ start, end, word: selected })
      setWordMapResult(null)
      setWordMapLoading(true)

      // Extract surrounding context (±60 chars)
      const context = textarea.value.slice(Math.max(0, start - 60), end + 60)
      fetchWordMap(selected, context, state.globalContext).then(result => {
        setWordMapResult(result)
        setWordMapLoading(false)
      })
    }
  }

  function applyWordMapSelection(item: string) {
    if (!wordMapSelection) return
    const { start, end } = wordMapSelection
    const before = editorContent.slice(0, start)
    const after = editorContent.slice(end)
    setEditorContent(before + item + after)
    setWordMapSelection(null)
  }

  function acceptSuggestion(original: string, replacement: string) {
    setEditorContent(c => c.replace(original, replacement))
    setSuggestions(prev => prev.filter(s => s.original !== original))
  }

  const charCount = editorContent.length
  const maxChars = selectedQuestion?.maxChars ?? null
  const isOverLimit = maxChars !== null && charCount > maxChars
  const charPercent = maxChars ? Math.min((charCount / maxChars) * 100, 100) : 0

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">자기소개서</h1>
          <p className="text-xs text-gray-500 mt-0.5">문항 관리 및 첨삭</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {state.questions.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">
              문항을 추가해서 시작하세요
            </p>
          )}
          {state.questions.map(q => (
            <div
              key={q.id}
              className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                q.id === state.selectedQuestionId
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => updateState(prev => ({ ...prev, selectedQuestionId: q.id }))}
            >
              {editingTitleId === q.id ? (
                <textarea
                  className="flex-1 text-sm bg-transparent border-b border-blue-400 outline-none resize-none"
                  value={q.title}
                  autoFocus
                  rows={3}
                  onChange={e => updateQuestionTitle(q.id, e.target.value)}
                  onBlur={() => setEditingTitleId(null)}
                  onKeyDown={e => e.key === 'Enter' && e.shiftKey === false && setEditingTitleId(null)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 text-sm break-words leading-snug"
                  onDoubleClick={e => { e.stopPropagation(); setEditingTitleId(q.id) }}
                >
                  {q.title}
                </span>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-xs p-0.5 mt-0.5 flex-shrink-0"
                onClick={e => { e.stopPropagation(); deleteQuestion(q.id) }}
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 space-y-2">
          {/* Global Context */}
          <div className="border-t border-gray-100 pt-2">
            <button
              onClick={() => setShowContext(v => !v)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>📌 전체 컨텍스트</span>
              <span>{showContext ? '▲' : '▼'}</span>
            </button>
            {showContext && (
              <textarea
                className="w-full mt-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2 resize-none outline-none focus:border-blue-300 min-h-[80px]"
                value={state.globalContext}
                onChange={e => updateState(prev => ({ ...prev, globalContext: e.target.value }))}
                placeholder={"지원 기업, 직무, 자신의 배경 등\n전체 첨삭에 반영할 컨텍스트를 입력하세요.\n\n예: 카카오 프론트엔드 개발자 지원, 5년차 React 개발자, 스타트업 경험 2개"}
              />
            )}
          </div>
          <button
            onClick={addQuestion}
            className="w-full py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + 문항 추가
          </button>
          <button
            onClick={handleGitPush}
            disabled={isPushing}
            className="w-full py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPushing ? '백업 중...' : '☁️ GitHub 백업'}
          </button>
          {pushMessage && (
            <p className="text-xs text-center text-green-600 px-2">{pushMessage}</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedQuestion ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg">왼쪽에서 문항을 선택하거나 추가하세요</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 pt-3 pb-2">
              {/* Title - full width, wrappable */}
              <textarea
                className="text-base font-semibold text-gray-900 bg-transparent border-none outline-none w-full resize-none overflow-hidden leading-snug mb-2 block"
                value={selectedQuestion.title}
                onChange={e => updateQuestionTitle(selectedQuestion.id, e.target.value)}
                placeholder="문항 제목"
                rows={1}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }}
                style={{ minHeight: '1.75rem' }}
              />
              {/* Controls row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>최대</span>
                  <input
                    type="number"
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-center text-sm"
                    value={selectedQuestion.maxChars ?? ''}
                    onChange={e => updateMaxChars(selectedQuestion.id, e.target.value)}
                    placeholder="제한없음"
                    min={0}
                  />
                  <span>자</span>
                </div>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  🕐 버전 {selectedQuestion.versions.length > 0 && `(${selectedQuestion.versions.length})`}
                </button>
                <button
                  onClick={() => {
                    const label = prompt('버전 이름을 입력하세요 (비워두면 자동 이름)')
                    saveVersion(label ?? undefined)
                  }}
                  className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  💾 저장
                </button>
                {/* Skill select + review button */}
                <div className="flex items-center gap-1">
                  <select
                    value={selectedSkillId}
                    onChange={e => setSelectedSkillId(e.target.value)}
                    disabled={isReviewing}
                    className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer disabled:opacity-50"
                  >
                    {skills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => reviewText ? setShowReviewPanel(v => !v) : handleReview()}
                    disabled={isReviewing || !editorContent.trim()}
                    className={`relative px-4 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      showReviewPanel && reviewText
                        ? 'text-purple-700 bg-purple-100 border border-purple-300'
                        : 'text-white bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isReviewing ? '첨삭 중...' : '✨ 첨삭'}
                    {reviewText && !isReviewing && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Editor + Review */}
            <div className="flex-1 flex overflow-hidden">
              {/* Editor Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Editor Tab Bar - show when review done or highlights exist */}
                {(reviewText || suggestions.length > 0 || showHighlights) && (
                  <div className="px-6 pt-2 pb-0 flex items-center gap-2 border-b border-gray-100 bg-white">
                    <button
                      onClick={() => setShowHighlights(false)}
                      className={`px-3 py-1.5 text-xs rounded-t-lg font-medium transition-colors ${
                        !showHighlights ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      ✏️ 작성
                    </button>
                    <button
                      onClick={() => {
                        if (suggestions.length === 0 && !isLoadingHighlights) handleFetchHighlights()
                        setShowHighlights(true)
                      }}
                      className={`px-3 py-1.5 text-xs rounded-t-lg font-medium transition-colors flex items-center gap-1 ${
                        showHighlights ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🔍 교정 보기
                      {suggestions.length > 0 && (
                        <span className="bg-amber-400 text-white text-xs px-1.5 rounded-full text-[10px]">
                          {suggestions.length}
                        </span>
                      )}
                      {isLoadingHighlights && <span className="text-amber-500 animate-pulse text-[10px]">분석 중...</span>}
                    </button>
                  </div>
                )}
                <div ref={editorContainerRef} className="flex-1 flex flex-col p-6 overflow-hidden">
                  {wordMapSelection && (
                    <WordMapPopup
                      word={wordMapSelection.word}
                      result={wordMapResult}
                      isLoading={wordMapLoading}
                      position={wordMapPosition}
                      onSelect={applyWordMapSelection}
                      onClose={() => setWordMapSelection(null)}
                    />
                  )}
                  {showHighlights ? (
                    isLoadingHighlights ? (
                      <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-xl">
                        <div className="text-center text-gray-400">
                          <div className="text-2xl mb-2 animate-spin">⟳</div>
                          <p className="text-sm">문장 분석 중...</p>
                        </div>
                      </div>
                    ) : (
                      <HighlightedText
                        content={editorContent}
                        suggestions={suggestions}
                        onAccept={acceptSuggestion}
                      />
                    )
                  ) : (
                    <textarea
                      ref={editorRef}
                      className="flex-1 resize-none outline-none text-base leading-relaxed text-gray-800 bg-white border border-gray-200 rounded-xl p-4 shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all"
                      value={editorContent}
                      onChange={e => setEditorContent(e.target.value)}
                      onKeyDown={handleEditorKeyDown}
                      placeholder="자기소개서 내용을 작성하세요... (단어 선택 후 ⌘+Enter로 유의어 검색)"
                    />
                  )}
                  {/* Character Count */}
                  <div className="mt-3 flex items-center gap-3">
                    {maxChars && (
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOverLimit ? 'bg-red-500' : charPercent > 90 ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${charPercent}%` }}
                        />
                      </div>
                    )}
                    <span className={`text-sm font-medium tabular-nums ${
                      isOverLimit ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {charCount.toLocaleString()}
                      {maxChars && ` / ${maxChars.toLocaleString()}`}
                      자
                      {isOverLimit && ` (${(charCount - maxChars!).toLocaleString()}자 초과)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Version History Sidebar */}
              {showVersions && (
                <div className="w-64 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-medium text-sm">버전 기록</span>
                    <button onClick={() => setShowVersions(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {selectedQuestion.versions.length === 0 && (
                      <p className="text-xs text-gray-400 text-center mt-6">저장된 버전이 없습니다</p>
                    )}
                    {[...selectedQuestion.versions].reverse().map(v => (
                      <div
                        key={v.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          v.id === selectedQuestion.activeVersionId
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => loadVersion(v.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 truncate">{v.label}</span>
                          <button
                            onClick={e => { e.stopPropagation(); deleteVersion(v.id) }}
                            className="text-gray-400 hover:text-red-500 text-xs ml-1 flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(v.createdAt)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{v.charCount.toLocaleString()}자</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claude Review Panel */}
              {showReviewPanel && (reviewText || isReviewing || reviewError) && (
                <div className="w-96 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      ✨ AI 첨삭
                      {skills.find(s => s.id === selectedSkillId) && (
                        <span className="text-xs text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-md">
                          {skills.find(s => s.id === selectedSkillId)?.name}
                        </span>
                      )}
                      {isReviewing && <span className="text-xs text-gray-400 animate-pulse">생성 중...</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isReviewing && reviewText && (
                        <button
                          onClick={() => handleReview(reviewFeedback, reviewText)}
                          className="text-xs text-purple-500 hover:text-purple-700 border border-purple-200 hover:border-purple-400 px-2 py-0.5 rounded-md transition-colors"
                        >
                          ↺ 다시 첨삭
                        </button>
                      )}
                      <button
                        onClick={() => setShowReviewPanel(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {reviewError ? (
                      <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">
                        <p className="font-medium">오류 발생</p>
                        <p className="mt-1 text-xs">{reviewError}</p>
                      </div>
                    ) : (
                      <MarkdownReview content={reviewText} isStreaming={isReviewing} />
                    )}
                  </div>
                  {/* Feedback input */}
                  {!isReviewing && reviewText && (
                    <div className="border-t border-gray-100 p-3 space-y-2">
                      <textarea
                        className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2.5 resize-none outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100 transition-all"
                        rows={2}
                        value={reviewFeedback}
                        onChange={e => setReviewFeedback(e.target.value)}
                        placeholder="피드백을 입력하세요&#10;예: 더 간결하게, 수치를 강조해줘, 스토리텔링 방식으로..."
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reviewFeedback.trim()) {
                            e.preventDefault()
                            handleReview(reviewFeedback, reviewText)
                          }
                        }}
                      />
                      <button
                        onClick={() => handleReview(reviewFeedback, reviewText)}
                        disabled={!reviewFeedback.trim()}
                        className="w-full py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ↩ 피드백 반영해서 재첨삭 <span className="text-purple-400 ml-1">⌘↵</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

    </div>
  )
}
