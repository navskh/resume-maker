import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-gray-900 mt-5 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-gray-900 mt-4 mb-1.5 flex items-center gap-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 leading-relaxed mb-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 space-y-1 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-gray-700 leading-relaxed flex gap-2">
      <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-400 bg-amber-50 pl-3 py-1.5 my-2 rounded-r-md text-sm text-amber-900">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    return isBlock ? (
      <pre className="bg-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-gray-800">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-purple-700">{children}</code>
    )
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-purple-50">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-100">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-purple-700 whitespace-nowrap border-b border-purple-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-700 align-top leading-relaxed">{children}</td>
  ),
}

interface Props {
  content: string
  isStreaming?: boolean
}

export default function MarkdownReview({ content, isStreaming }: Props) {
  return (
    <div className="prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1 h-3.5 bg-purple-500 animate-pulse ml-0.5 align-middle rounded-sm" />
      )}
    </div>
  )
}
