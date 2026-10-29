import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, MemberAiAnswer
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  MemberAiAnswer = (await server.ssrLoadModule('/src/pages/member/MemberAiAnswer.jsx')).default
})
after(async () => { await server?.close() })
const render = answer => renderToStaticMarkup(createElement(MemberAiAnswer, { answer }))

test('AI package markdown becomes an accessible table without changing prices or durations', () => {
  const html = render('Các gói tập hiện có:\n\n| Gói tập | Giá | Thời hạn (ngày) |\n|---|---:|---:|\n| Flex Pass – Tự Do | 1000đ | 30 ngày |\n| Gold All-Access | 2000đ | 180 ngày |\n\nBạn có thể chọn gói phù hợp.')
  assert.match(html, /role="region" aria-label="Bảng thông tin từ trợ lý AI" tabindex="0"/)
  assert.match(html, /<table>/)
  assert.match(html, /<thead><tr><th>Gói tập<\/th>/)
  assert.equal((html.match(/<tbody>|<tr>/g) || []).length, 4)
  for (const value of ['1000đ', '30 ngày', '2000đ', '180 ngày']) assert.ok(html.includes(value))
  assert.ok(!html.includes('|---'))
  assert.match(html, /<p>Bạn có thể chọn gói phù hợp\.<\/p>/)
})

test('headings, emphasis, ordered steps and bullet points are rendered as structured text', () => {
  const html = render('### Khởi động\n\nDành **5 phút** để làm nóng.\n\n1. Đi bộ nhẹ\n2. Xoay khớp\n\n- Uống nước\n- Tăng dần cường độ')
  assert.match(html, /<h3>Khởi động<\/h3>/)
  assert.match(html, /<strong>5 phút<\/strong>/)
  assert.match(html, /<ol>/)
  assert.match(html, /<ul>/)
  assert.equal((html.match(/<li>/g) || []).length, 4)
})

test('unformatted replies and code keep their text', () => {
  assert.match(render('Gói tập còn hiệu lực.\nBuổi học lúc 18:00.'), /Gói tập còn hiệu lực\.\nBuổi học lúc 18:00\./)
  assert.match(render('Ví dụ: `18:00`\n\n```text\nYoga | 18:00\n```'), /<pre><code[^>]*>Yoga \| 18:00/)
})

test('AI output cannot inject HTML, execute unsafe links or load remote images', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[Không an toàn](javascript:alert)\n\n![Mô tả ảnh](https://example.test/track.png)\n\n[Tham khảo](https://example.test/info)')
  assert.doesNotMatch(html, /<script|<img|onerror|javascript:|track\.png/)
  assert.match(html, /Mô tả ảnh/)
  assert.match(html, /href="https:\/\/example.test\/info"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
})
