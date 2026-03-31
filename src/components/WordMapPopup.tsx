import { useEffect, useRef } from 'react'
import type { WordMapResult } from '../types'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  '유의어':             { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   hover: 'hover:bg-blue-100' },
  '유사 표현':          { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', hover: 'hover:bg-violet-100' },
  '자기소개서 강화 표현': { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',hover: 'hover:bg-emerald-100' },
  '반의/대조':          { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  hover: 'hover:bg-amber-100' },
}

const DEFAULT_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', hover: 'hover:bg-gray-100' }

interface Props {
  word: string
  result: WordMapResult | null
  isLoading: boolean
  position: { top: number; left: number; maxWidth: number }
  onSelect: (item: string) => void
  onClose: () => void
}

export default function WordMapPopup({ word, result, isLoading, position, onSelect, onClose }: Props) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in"
      style={{
        top: position.top,
        left: position.left,
        maxWidth: position.maxWidth,
        minWidth: 300,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
            {word}
          </span>
          <span className="text-xs text-gray-400">단어 매핑</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-500 transition-colors text-sm p-1"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-4 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <span className="animate-spin text-lg">⟳</span>
            <span className="text-sm">단어 분석 중...</span>
          </div>
        ) : !result || result.categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">결과를 가져올 수 없습니다</p>
        ) : (
          <div className="space-y-4">
            {result.categories.map(category => {
              const color = CATEGORY_COLORS[category.type] ?? DEFAULT_COLOR
              return (
                <div key={category.type}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {category.type}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.items.map(item => (
                      <button
                        key={item}
                        onClick={() => { onSelect(item); onClose() }}
                        className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${color.bg} ${color.text} ${color.border} ${color.hover} hover:shadow-sm active:scale-95`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!isLoading && result && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400">단어를 클릭하면 선택한 텍스트와 교체됩니다 · Esc로 닫기</p>
        </div>
      )}
    </div>
  )
}
