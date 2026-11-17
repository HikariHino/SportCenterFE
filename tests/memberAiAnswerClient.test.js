import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, createRoot, MemberAiAnswer
const descriptors = new Map()

before(async () => {
  window = new Window({ url: 'http://localhost:3000/member' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  MemberAiAnswer = (await server.ssrLoadModule('/src/pages/member/MemberAiAnswer.jsx')).default
  createRoot = (await import('react-dom/client')).createRoot
})

after(async () => {
  await server?.close()
  await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('new AI answers reveal characters progressively and finish with the full Markdown response', async () => {
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  let completed = 0
  const answer = 'Xin chào hội viên'
  try {
    await act(async () => root.render(h(MemberAiAnswer, { answer, animate: true, onAnimationComplete: () => { completed++ } })))
    assert.equal(container.querySelector('.member-ai-answer').textContent, '')
    assert.ok(container.querySelector('.member-ai-answer-caret'))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 55)) })
    const partial = container.querySelector('.member-ai-answer').textContent
    assert.ok(partial.length > 0 && partial.length < answer.length, partial)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, answer.length * 22 + 180)) })
    assert.equal(container.querySelector('.member-ai-answer').textContent, answer)
    assert.equal(container.querySelector('.member-ai-answer-caret'), null)
    assert.equal(completed, 1)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

test('historical answers render immediately without starting the typewriter', async () => {
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  const answer = 'Nội dung đã lưu'
  try {
    await act(async () => root.render(h(MemberAiAnswer, { answer })))
    assert.equal(container.querySelector('.member-ai-answer').textContent, answer)
    assert.equal(container.querySelector('.member-ai-answer-caret'), null)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
