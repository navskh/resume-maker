import { useState } from 'react'
import type { Suggestion } from '../types'

interface Segment {
  text: string
  suggestion?: Suggestion
}

function segmentText(content: string, suggestions: Suggestion[]): Segment[] {
  let segments: Segment[] = [{ text: content }]
  for (const s of suggestions) {
    const next: Segment[] = []
    for (const seg of segments) {
      if (seg.suggestion) { next.push(seg); continue }
      const idx = seg.text.indexOf(s.original)
      if (idx === -1) { next.push(seg); continue }
      if (idx > 0) next.push({ text: seg.text.slice(0, idx) })
      next.push({ text: s.original, suggestion: s })
      const after = seg.text.slice(idx + s.original.length)
      if (after) next.push({ text: after })
    }
    segments = next
  }
  return segments
}

function HighlightSpan({ text, suggestion, onAccept }: {
  text: string
  suggestion: Suggestion
  onAccept: (original: string, replacement: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline">
      <mark
        className="bg-amber-100 border-b-2 border-amber-400 cursor-pointer rounded-sm px-0.5 hover:bg-amber-200 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {text}
      </mark>
      {show && (
        <span
          className="absolute bottom-full left-0 z-50 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl"
          style={{ transform: 'translateY(-4px)' }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <div className="text-amber-400 font-medium mb-1.5">{suggestion.reason}</div>
          <div className="text-gray-400 line-through mb-1 text-xs">{suggestion.original}</div>
          <div className="text-green-400 mb-2">→ {suggestion.replacement}</div>
          <button
            onMouseDown={e => { e.preventDefault(); onAccept(suggestion.original, suggestion.replacement); setShow(false) }}
            className="w-full py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            ✓ 적용하기
          </button>
        </span>
      )}
    </span>
  )
}

interface Props {
  content: string
  suggestions: Suggestion[]
  onAccept: (original: string, replacement: string) => void
}

export default function HighlightedText({ content, suggestions, onAccept }: Props) {
  const segments = segmentText(content, suggestions)
  return (
    <div className="flex-1 overflow-y-auto text-base leading-relaxed text-gray-800 bg-white border border-amber-200 rounded-xl p-4 shadow-sm whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.suggestion ? (
          <HighlightSpan
            key={i}
            text={seg.text}
            suggestion={seg.suggestion}
            onAccept={onAccept}
          />
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  )
}
