const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('Achievements route is disabled while Assignments remains in navigation', () => {
  const route = read('src/app/(dashboard)/achievements/page.tsx')
  assert.match(route, /notFound\(\)/)
  for (const file of [
    'src/components/layout/sidebar.tsx',
    'src/components/layout/assistant-sidebar.tsx',
    'src/components/layout/mobile-nav.tsx',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /href:\s*["']\/dashboard\/achievements["']/)
    assert.match(source, /href:\s*["']\/dashboard\/assignments["']/)
  }
})

test('Assistant remounts chat on conversation switch and supports delete API', () => {
  const page = read('src/app/(dashboard)/assistant/page.tsx')
  const chat = read('src/components/rag/rag-chat.tsx')
  assert.match(page, /key=\{selectedConversation\}/)
  assert.match(page, /fetch\(`\/api\/conversations\/\$\{id\}`\s*,\s*\{\s*method:\s*["']DELETE["']/)
  assert.match(chat, /queryFn:\s*async\s*\(\{\s*signal\s*\}\)/)
  assert.match(chat, /onConversationCreated\(data\.conversationId\)/)
  assert.match(chat, /Retry loading history/)
})

test('Attached files are bounded and included in RAG context even without saved-document hits', () => {
  const route = read('src/app/api/rag/query/route.ts')
  assert.match(route, /body\.attachments\.length\s*>\s*5/)
  assert.match(route, /file\.size\s*>\s*10\s*\*\s*1024\s*\*\s*1024/)
  assert.match(route, /if\s*\(attachmentContext\.length\s*>\s*0\)\s*hasRelevantSourceEvidence\s*=\s*true/)
  assert.match(route, /active embedding-capable provider/i)
})

test('AI provider requests retry transient overload and surface a friendly 503 error', () => {
  const service = read('src/lib/ai/service.ts')
  assert.match(service, /export async function fetchWithAIRetry/)
  assert.match(service, /\[429,\s*503\]/)
  assert.match(service, /Retry-After/)
  assert.match(service, /MODEL_CAPACITY_EXHAUSTED/)
  assert.match(service, /MODEL_TEMPORARILY_UNAVAILABLE/)
  assert.match(service, /Math\.min\(4, Math\.floor\(maxRetries\)\)/)
})

test('Markdown renderer has safe link protocols, responsive tables and code-copy controls', () => {
  const markdown = read('src/components/ui/markdown.tsx')
  assert.match(markdown, /overflow-x-auto/)
  assert.match(markdown, /Copy code/)
  assert.match(markdown, /https\?:\|mailto:\|\\\/\|#/)
})
