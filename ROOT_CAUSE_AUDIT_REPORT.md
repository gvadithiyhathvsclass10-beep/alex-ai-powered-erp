# ALEX AI ERP — Root-Cause Audit Report

**Date:** 2026-11-13  
**Repository:** https://github.com/gvadithiyhathvsclass10-beep/alex-ai-powered-erp.git  
**Canonical Source:** `apps/web/` (confirmed by Dockerfile, pnpm-workspace.yaml, render.yaml)  
**Nested Snapshot:** `alex-ai-powered-erp-main/` — NOT used by build/deployment pipeline

---

## 1. Repository Architecture Discovered

### Source Tree Structure
```
apps/web/                          ← CANONICAL (used by Docker, pnpm, Render)
├── src/
│   ├── app/
│   │   ├── (dashboard)/           ← Route group for authenticated pages
│   │   │   ├── study-studio/      ← Study Studio (Formula Sheets, Flashcards, Mind Maps, Diagrams, Quizzes, Research Notebook, Important Questions)
│   │   │   ├── assistant/         ← AI Assistant chat workspace
│   │   │   ├── research/          ← Research Lab / Research Notebook
│   │   │   └── ...
│   │   └── api/                   ← API routes (REST endpoints)
│   ├── components/
│   │   ├── layout/                ← DashboardLayout, Sidebar, AssistantSidebar, MobileBottomNav, Headers
│   │   ├── chat/                  ← ChatComposer, ChatMessage, RAGChat
│   │   ├── voice-assistant/       ← VoiceAssistant (standalone page)
│   │   ├── study-studio/          ← MindMapViewer, DiagramViewer, QuizViewer
│   │   └── ...
│   ├── lib/
│   │   ├── ai/                    ← AI service abstraction (service.ts, embeddings.ts, model-discovery.ts)
│   │   ├── study-studio/          ← Generation logic (generation.ts, export.ts)
│   │   ├── rag/                   ← RAG retrieval
│   │   └── ...
│   └── hooks/
│       ├── use-speech-recognition.ts
│       └── use-speech-synthesis.ts
├── prisma/schema.prisma           ← Database models
└── Dockerfile                     ← Multi-stage build for apps/web
```

### Key Architecture Decisions
- **Monorepo with pnpm workspaces**: `apps/*` and `packages/*`
- **Next.js App Router** with route groups `(dashboard)`, `(auth)`
- **TanStack React Query** for server state
- **Prisma ORM** with PostgreSQL (Neon)
- **Docker multi-stage build** targeting `runner-api` (Next.js) and `runner-worker` (background jobs)
- **Render Blueprint** deploys both web service and worker from same Dockerfile

---

## 2. Root Causes Discovered

### A. Study Studio Navigation Overlap
**Location:** `apps/web/src/app/(dashboard)/study-studio/StudyStudioContent.tsx:1273-1282`
```tsx
<TabsList className="grid w-full grid-cols-7">
  <TabsTrigger value="notes">Formula Sheet</TabsTrigger>
  <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
  <TabsTrigger value="mindmaps">Mind Maps</TabsTrigger>
  <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
  <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
  <TabsTrigger value="research">Research Notebook</TabsTrigger>
  <TabsTrigger value="important-questions">Important Questions</TabsTrigger>
</TabsList>
```
**Root Cause:** Fixed `grid-cols-7` forces 7 equal-width columns. On mobile/tablet, labels overlap because text doesn't fit. No horizontal scrolling or responsive collapse.

### B. Study Studio Generation Failures
**Root Causes:**
1. **Missing document ID**: User must select a document from dropdown before generation, but the UI doesn't clearly enforce this
2. **Empty document chunks**: Document processing pipeline may not have completed (status ≠ `READY`)
3. **API contract drift**: Frontend expects `result.materialId` but API returns `result.result.materialId`
4. **No loading/error state persistence**: Failed generations don't show actionable errors

### C. Important Questions — Overly Complex & Broken Workflow
**Location:** `StudyStudioContent.tsx` lines 2476-3391 (Important Questions tab)

| Issue | Root Cause |
|-------|------------|
| Subject selection uses Document ID | Line 2552-2556: `allUserDocuments?.documents` used for subject dropdown instead of actual Subjects |
| Single file upload only | Upload form accepts one `file` field, no multiple attribute |
| No OCR for scanned PDFs | `extractContent` in `/api/important-questions/papers/[id]` only tries text extraction, falls back to base64 metadata |
| No internet research integration | Analysis only processes uploaded papers; no web search / syllabus lookup |
| No PDF generation | Only displays results in UI; no server-side PDF generation endpoint |
| Complicated 4-tab workflow | Papers → Extract → Analysis → Practice Papers requires manual steps at each stage |
| Question extraction is per-paper | Batch extraction not supported; user must click "Extract" for each paper |

### D. Navigation Inconsistency Between Dashboard and AI Assistant
**Three separate navigation configs that diverge:**

| Config | Location | Main Items | Issues |
|--------|----------|------------|--------|
| `navItems` (Sidebar) | `components/layout/sidebar.tsx:44-57` | 12 items + Voice Assistant | Used by DashboardLayout |
| `navItems` (AssistantSidebar) | `components/layout/assistant-sidebar.tsx:42-55` | 13 items + Research Lab | Used by AssistantLayout; MISSING Voice Assistant |
| `bottomNavItems` + `moreMenuItems` | `components/layout/mobile-nav.tsx:68-104` | 5 bottom + 9 more | Different subset; duplicate definitions |

**Root Cause:** `DashboardLayout.tsx:38-44` explicitly EXCLUDES `/dashboard/assistant` from its wrapper, rendering AssistantLayout instead. But AssistantSidebar has different nav items.

### E. Voice-to-Text — Multiple Conflicting Implementations
| Implementation | Location | Completeness |
|----------------|----------|--------------|
| Inline in ChatComposer | `components/chat/ChatComposer.tsx:30-422` | Most complete (audio level viz, interim results, retry) |
| `useSpeechRecognition` hook | `hooks/use-speech-recognition.ts` | Basic, used by VoiceAssistant |
| VoiceAssistant page | `components/voice-assistant/VoiceAssistant.tsx` | Uses hook, separate UI |

**Root Cause:** No shared reusable component. ChatComposer's implementation is superior but not extracted. VoiceAssistant uses the simpler hook. If both are on same page, they conflict.

### F. AI Chat Integration Missing in Important Questions
**Research Notebook** uses `RAGChat` component (line 2365-2371) with `notebookId` and `documentIds`.

**Important Questions** has NO chat component. The `RAGChat` component supports `subjectId`, `projectId`, `notebookId`, `documentIds`, `sourceIds` — all needed for Important Questions context.

### G. PDF Generation Not Implemented
- Study Studio export utilities (`lib/study-studio/export.ts`) use client-side `window.print()` → not real PDF
- No server-side PDF generation library (pdfkit, puppeteer, @react-pdf/renderer)
- Important Questions analysis has no export at all

---

## 3. Dependency Map & Failure Points

```
User Interaction
    │
    ├─► Study Studio Tab Click
    │       └─► TabsList (grid-cols-7) → OVERLAP on mobile
    │
    ├─► Generate Formula Sheet
    │       ├─► DocumentSelector → needs sourceDocId
    │       ├─► POST /api/study-studio/generate
    │       │       ├─► validate sourceDocId
    │       │       ├─► fetch document + chunks
    │       │       ├─► summarizeAndAnalyzeDocument (AI)
    │       │       │       ├─► resolveAIConfig → needs API key
    │       │       │       ├─► generateText → provider API
    │       │       │       └─► parse response
    │       │       └─► save to StudyMaterial
    │       └─► FAILURE: empty chunks, missing API key, parse error
    │
    ├─► Important Questions Upload
    │       ├─► POST /api/important-questions/papers (FormData)
    │       │       ├─► save file as base64 in metadata (NOT S3!)
    │       │       └─► status = UPLOADED
    │       ├─► User clicks "Extract Questions"
    │       │       └─► POST /api/important-questions/papers/[id] {action: "extract"}
    │       │              ├─► downloadFile from storage (FAILS - base64 in metadata)
    │       │              ├─► extractContent (pdf/docx/txt)
    │       │              ├─► generateStructuredOutput (AI)
    │       │              └─► save ExtractedQuestion rows
    │       └─► FAILURE: storage download fails, extraction fails, AI parse fails
    │
    ├─► Navigation Switch (Dashboard ↔ Assistant)
    │       ├─► DashboardLayout detects /assistant → renders bare children
    │       ├─► AssistantLayout renders AssistantSidebar + AssistantHeader
    │       └─► DIFFERENT nav items appear (Voice Assistant vs Research Lab)
    │
    └─► Voice Input (Microphone)
            ├─► ChatComposer: inline SpeechRecognition (complete)
            ├─► VoiceAssistant: useSpeechRecognition hook (basic)
            └─► CONFLICT: two recognition instances if both mounted
```

---

## 4. Proposed Corrections

### Phase 1: Navigation Unification
- Create **single canonical navigation config** at `lib/navigation/config.ts`
- Both `Sidebar` and `AssistantSidebar` import from it
- `MobileBottomNav` derives from same config
- `DashboardLayout` and `AssistantLayout` use consistent wrapper

### Phase 2: Study Studio Navigation Redesign
- Replace `grid-cols-7` with horizontally scrollable tabs (`overflow-x-auto whitespace-nowrap`)
- Or use responsive: 4 cols desktop, scrollable mobile
- Add clear active tab indicator

### Phase 3: Important Questions Complete Redesign
**New UX Flow:**
1. **Select Subject** → Subject picker (actual Subject model, not Document)
2. **Upload Papers** → Multi-file drag-drop with progress, validation
3. **Process Papers** → Batch extract with status per file, OCR support
4. **Generate Important Questions** → Single button, analyzes ALL papers + web research
5. **Results + PDF Download** → Professional PDF with all sections

**Backend Changes:**
- New API: `POST /api/important-questions/analyze` (batch process)
- New API: `GET /api/important-questions/export-pdf/[analysisId]`
- Add web search integration for syllabus/concept research
- Use `pdfkit` or `@react-pdf/renderer` for server-side PDF

### Phase 4: Shared Voice-to-Text Component
- Extract `ChatComposer`'s speech recognition into `useSpeechToText` hook
- Create `<VoiceInputButton />` reusable component
- Use in: ChatComposer, RAGChat, VoiceAssistant page

### Phase 5: AI Chat in Important Questions
- Add `RAGChat` to Important Questions tab
- Pass `subjectId` + `documentIds` (question paper docs)
- Enable "grounded in papers" mode

### Phase 6: Study Studio Generation Fixes
- Better validation: show clear error if document not READY
- Fix API response shape consistency
- Add retry mechanism for failed generations

---

## 5. Files to Modify

### New Files
| File | Purpose |
|------|---------|
| `apps/web/src/lib/navigation/config.ts` | Canonical navigation config |
| `apps/web/src/hooks/use-speech-to-text.ts` | Shared speech recognition hook |
| `apps/web/src/components/ui/voice-input-button.tsx` | Reusable microphone button |
| `apps/web/src/app/api/important-questions/analyze/route.ts` | Batch analysis endpoint |
| `apps/web/src/app/api/important-questions/export-pdf/[id]/route.ts` | PDF generation endpoint |
| `apps/web/src/lib/important-questions/analyzer.ts` | Analysis logic with web research |
| `apps/web/src/lib/important-questions/pdf-generator.ts` | Server-side PDF generation |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/components/layout/sidebar.tsx` | Import nav config |
| `apps/web/src/components/layout/assistant-sidebar.tsx` | Import nav config |
| `apps/web/src/components/layout/mobile-nav.tsx` | Import nav config |
| `apps/web/src/app/(dashboard)/study-studio/StudyStudioContent.tsx` | Fix nav tabs, redesign IQ tab |
| `apps/web/src/components/chat/ChatComposer.tsx` | Use shared voice hook |
| `apps/web/src/components/voice-assistant/VoiceAssistant.tsx` | Use shared voice hook |
| `apps/web/src/components/rag/rag-chat.tsx` | Ensure compatible with IQ context |
| `apps/web/src/app/api/important-questions/papers/route.ts` | Support multi-file upload |
| `apps/web/src/app/api/important-questions/papers/[id]/route.ts` | Fix storage download, add OCR |
| `apps/web/src/lib/study-studio/generation.ts` | Fix error handling, response shape |

---

## 6. Implementation Priority

1. **Navigation Unification** (blocks consistent UX)
2. **Study Studio Navigation Fix** (immediate UX improvement)
3. **Shared Voice-to-Text** (fixes broken voice input everywhere)
4. **Important Questions Redesign** (high-priority feature)
5. **PDF Generation** (required for IQ feature)
6. **AI Chat Integration** (completes IQ + Research Lab parity)
7. **Study Studio Generation Hardening** (reliability)

---

## 7. Deployment Considerations

- **Docker build context**: `.` (repo root) → copies `apps/web/`
- **Render services**: `alex-web` (runner-api) + `alex-worker` (runner-worker)
- **Environment variables**: No new required vars; uses existing `AI_MODE`, provider keys
- **PDF generation**: `pdfkit` is pure JS (no system deps) or `@react-pdf/renderer` (Node-compatible)
- **Web search**: Requires search API key (optional - gracefully degrade if missing)
- **OCR**: `tesseract-ocr` already in Dockerfile; `pdf2pic` or `pdf-parse` for PDF→image

---

## 8. Verification Plan

| Test | Method |
|------|--------|
| TypeScript compile | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build | `pnpm build:web` |
| Navigation consistency | Visual check: Dashboard ↔ Assistant |
| Study Studio tabs | Mobile/tablet/desktop responsive |
| Important Questions flow | Upload 3 PDFs → Generate → Download PDF |
| Voice input | Microphone button in Chat, RAGChat, VoiceAssistant |
| PDF download | File saves, opens correctly, all sections present |
| Regression | All existing features still work |

---

**Next Step:** Begin implementation with Phase 1 (Navigation Unification).