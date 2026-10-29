import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const remarkPlugins = [remarkGfm]
const components = {
  table: ({ children }) => (
    <div className="member-ai-answer-table" role="region" aria-label="Bảng thông tin từ trợ lý AI" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children, title }) => href
    ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  img: ({ alt }) => <span>{alt}</span>,
}

export default memo(function MemberAiAnswer({ answer }) {
  return (
    <div className="member-ai-answer">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components} skipHtml>{answer}</ReactMarkdown>
    </div>
  )
})
