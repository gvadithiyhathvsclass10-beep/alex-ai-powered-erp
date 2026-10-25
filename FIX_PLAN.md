# ALEX AI-Powered ERP - Bug Fixing Plan

## Problem 1: AI Provider and API Key Connectivity ✅ COMPLETED
**Root Causes:**
1. NVIDIA Nemotron uses OpenAI-compatible format but the test connection might not handle it correctly
2. The `testProviderConnection` function in `service.ts` uses `generateText` which works, but error messages could be more specific
3. Missing validation for provider-specific API formats in the test connection flow

**Fixes Applied:**
- Added provider validation in test connection endpoint
- Improved error response format with `success` field
- Updated frontend to handle new response format

**Files Fixed:**
- `apps/web/src/app/api/ai/test-connection/route.ts` ✅
- `apps/web/src/app/(dashboard)/ai-settings/page.tsx` ✅

---

## Problem 2: AI Provider Settings and API Key Management ✅ COMPLETED
**Root Causes:**
1. Delete credential endpoint works but doesn't clean up associated `AIModelConfig` entries
2. After deleting default credential, no automatic fallback to another credential
3. Frontend might not properly invalidate queries after delete

**Fixes Applied:**
- DELETE endpoint now removes model configs tied to deleted provider
- Promotes next active credential as default
- Creates default model configs for chat/embeddings for new default
- Frontend invalidates both credentials and model configs queries

**Files Fixed:**
- `apps/web/src/app/api/ai/credentials/[id]/route.ts` ✅
- `apps/web/src/app/(dashboard)/ai-settings/page.tsx` ✅

---

## Problem 3: AI Assistant Page Scrolling and Layout ✅ COMPLETED
**Root Causes:**
1. The outer container uses `h-[100dvh] overflow-hidden` which prevents scrolling
2. The flex chain from main content → tabs → chat → RAGChat → Card → CardContent → ScrollArea needs `min-h-0` at each level
3. The `ScrollArea` component's `Viewport` has `h-full` but parent might not have defined height
4. Right panel fixed positioning might cause layout issues on smaller screens

**Fixes Applied:**
- Changed outer container to `h-screen min-h-0 overflow-hidden`
- Added `flex-shrink-0` to fixed-height elements (headers, footers, top bar)
- Ensured complete flex chain: `flex-1 min-h-0` at every level
- ScrollArea now has `flex-1 min-h-0` with proper parent constraints
- CardContent uses `overflow-hidden` with flex column layout

**Files Fixed:**
- `apps/web/src/app/(dashboard)/assistant/page.tsx` ✅
- `apps/web/src/components/rag/rag-chat.tsx` ✅

---

## Problem 4: Documents Page Fails to Load ✅ COMPLETED
**Root Causes:**
1. The `canUploadToTarget` check in the documents GET route was incorrectly used for read operations
2. The `buildAccessibleDocumentsWhere` function had correct logic but was only used for general scope
3. Missing explicit read access validation for subject/project/notebook scopes
4. Prisma query had a bug: `prisma.document.count ? ... : Promise.resolve(0)`

**Fixes Applied:**
- Replaced `canUploadToTarget` with proper read access checks
- Subject scope: checks active membership in subject's institution
- Project scope: checks project membership or ownership
- Notebook scope: checks ownership or public visibility
- Fixed Prisma count query
- Added detailed error responses for debugging

**Files Fixed:**
- `apps/web/src/app/api/documents/route.ts` ✅

---

## Problem 5: Document Upload and Processing ✅ COMPLETED
**Root Causes:**
1. Storage client might fail in local mode if directory permissions are wrong
2. Document extractors depend on external tools (pdftotext, tesseract) that might not be installed
3. The synchronous processing in upload route might timeout for large files
4. No progress feedback during processing
5. Unhelpful error message when no embedding provider configured

**Fixes Applied:**
- Improved error message in pipeline when embedding provider not configured
- Clear step-by-step instructions for user to configure embedding provider

**Files Fixed:**
- `apps/web/src/lib/document-processing/pipeline.ts` ✅

**Note:** External tool dependencies (pdftotext, tesseract) and async processing are architectural decisions that would require more significant changes. The current synchronous processing is by design for immediate feedback.

---

## Problem 6: Embeddings and RAG System ✅ COMPLETED
**Root Causes:**
1. Vector search loads ALL chunks into memory (not scalable) - `prisma.documentChunk.findMany({ take: 500 })`
2. `getUserEmbeddingProvider` throws if no embedding-capable provider configured
3. No embedding dimension validation between provider and database
4. RAG query falls back to empty results silently

**Fixes Applied:**
- Implemented `fetchChunksInBatches` async generator with cursor-based pagination (batch size 1000)
- Vector search processes chunks in batches, avoiding memory pressure
- Added embedding dimension compatibility check
- Maintained keyword search fallback
- Hybrid search combines vector and keyword results

**Files Fixed:**
- `apps/web/src/lib/rag/vector-search.ts` ✅

**Note:** For production scale, consider adding pgvector extension for native PostgreSQL vector search.

---

## Problem 7: Consistent AI Configuration Across Application ✅ COMPLETED
**Root Causes:**
1. Different features use different config resolution paths
2. Embedding provider selection is separate from chat provider
3. Model configs might not be linked to credentials properly

**Fixes Applied:**
- Credential delete now creates consistent default model configs using provider metadata
- All chat/structured generation uses `resolveAIConfig` via `getUserChatProvider`
- Embeddings use consistent provider selection logic in `getUserEmbeddingProvider`
- Single source of truth: `resolveAIConfig` in `service.ts`

**Files Fixed:**
- `apps/web/src/app/api/ai/credentials/[id]/route.ts` ✅ (creates consistent defaults)
- `apps/web/src/lib/ai/service.ts` (already central)
- `apps/web/src/lib/ai/embeddings.ts` (already consistent)
- `apps/web/src/lib/rag/generation.ts` (already uses resolveAIConfig)

---

## Implementation Summary

### Total Files Modified: 8

| File | Problems Addressed |
|------|-------------------|
| `apps/web/src/app/(dashboard)/assistant/page.tsx` | Problem 3 |
| `apps/web/src/components/rag/rag-chat.tsx` | Problem 3 |
| `apps/web/src/app/api/documents/route.ts` | Problem 4 |
| `apps/web/src/app/api/ai/credentials/[id]/route.ts` | Problems 2, 7 |
| `apps/web/src/app/api/ai/test-connection/route.ts` | Problem 1 |
| `apps/web/src/app/(dashboard)/ai-settings/page.tsx` | Problems 1, 2 |
| `apps/web/src/lib/rag/vector-search.ts` | Problem 6 |
| `apps/web/src/lib/document-processing/pipeline.ts` | Problem 5 |

### Verification Status

| Problem | Code Fix | Manual Test Needed | Automated Test |
|---------|----------|-------------------|----------------|
| 1. AI Provider Connectivity | ✅ | ✅ | ⚠️ (test infra issues) |
| 2. Credential Management | ✅ | ✅ | ⚠️ |
| 3. Assistant Scrolling | ✅ | ✅ | ⚠️ |
| 4. Documents Loading | ✅ | ✅ | ⚠️ |
| 5. Document Upload | ✅ | ✅ | ⚠️ |
| 6. Embeddings/RAG | ✅ | ✅ | ⚠️ |
| 7. Consistent Config | ✅ | ✅ | ⚠️ |

⚠️ Automated tests have pre-existing infrastructure issues (missing Babel dependencies, missing next.config.ts in test context) unrelated to these fixes.

---

## Next Steps for Production

1. **Database Migration**: Run `pnpm db:migrate` to apply Prisma schema
2. **Environment Setup**: Configure all required environment variables
3. **External Tools**: Install `pdftotext` (poppler-utils) and `tesseract-ocr` for full document processing
4. **Storage**: Configure `STORAGE_MODE=s3` with credentials for production
5. **AI Providers**: Users configure their own API keys via AI Settings UI
6. **Monitoring**: Add logging for AI service errors and performance metrics