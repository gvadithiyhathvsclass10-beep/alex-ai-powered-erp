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
  assert.match(route, /does not need to be embedded or persisted/i)
  assert.doesNotMatch(route, /getUserEmbeddingProvider\(user\.id\)/)
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

test('Assistant provider selector does not render an invalid empty SelectItem', () => {
  const page = read('src/app/(dashboard)/assistant/page.tsx')
  assert.match(page, /providers\.length\s*>\s*0\s*\?/)
  assert.match(page, /Configure AI provider/)
  assert.doesNotMatch(page, /<SelectItem\s+value=""/)
})

test('RAG query rejects missing or unauthorized conversation IDs before generation', () => {
  const route = read('src/app/api/rag/query/route.ts')
  assert.match(route, /Conversation not found\. Start a new chat and try again\./)
  assert.match(route, /conversation\.userId !== user\.id && user\.role !== 'ADMIN'/)
  assert.match(route, /You do not have access to this conversation\./)
})

test('Chat UI surfaces non-JSON API errors and rejects empty AI responses', () => {
  const chat = read('src/components/rag/rag-chat.tsx')
  assert.match(chat, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/)
  assert.match(chat, /payload\.error \|\| payload\.message/)
  assert.match(chat, /AI provider returned an empty response/)
})

test('RAG endpoint permits attachment-only messages without requiring an embedding model', () => {
  const route = read('src/app/api/rag/query/route.ts')
  assert.match(route, /Please analyze the attached file\(s\) and summarize the key information\./)
  assert.match(route, /const hasAttachments = Array\.isArray\(body\.attachments\)/)
  assert.doesNotMatch(route, /getUserEmbeddingProvider/)
})

test('Attachment preview URLs are not revoked on every composer state update', () => {
  const composer = read('src/components/chat/ChatComposer.tsx')
  assert.match(composer, /attachmentsRef\.current = attachments/)
  assert.match(composer, /Revoke preview URLs only when the composer unmounts/)
  assert.match(composer, /\}, \[\]\)/)
})
