import { memo, useEffect, useRef, useState } from 'react'
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

export default memo(function MemberAiAnswer({ answer, animate = false, onAnimationComplete }) {
  const fullAnswer = String(answer ?? '')
  const [visibleAnswer, setVisibleAnswer] = useState(animate ? '' : fullAnswer)
  const completeRef = useRef(onAnimationComplete)
  completeRef.current = onAnimationComplete

  useEffect(() => {
    if (!animate) {
      setVisibleAnswer(fullAnswer)
      return undefined
    }

    let visibleLength = 0
    setVisibleAnswer('')
    const timer = window.setInterval(() => {
      visibleLength += 1
      if (visibleLength >= fullAnswer.length) {
        window.clearInterval(timer)
        setVisibleAnswer(fullAnswer)
        completeRef.current?.()
        return
      }
      setVisibleAnswer(fullAnswer.slice(0, visibleLength))
    }, 22)

    return () => window.clearInterval(timer)
  }, [animate, fullAnswer])

  const typing = animate && visibleAnswer.length < fullAnswer.length
  return (
    <div className="member-ai-answer">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components} skipHtml>{visibleAnswer}</ReactMarkdown>
      {typing && <span className="member-ai-answer-caret" aria-hidden="true" />}
    </div>
  )
})
