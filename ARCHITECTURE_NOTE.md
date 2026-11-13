# ALEX Important Questions V2 - Architecture Note & Integration Plan

## Current Repository Architecture (V1)

### Prisma Models (Already Exist)
- `QuestionPaper` - uploaded question papers with metadata
- `ExtractedQuestion` - individual questions extracted from papers
- `QuestionAnalysis` - analysis results with priority items
- `QuestionAnalysisItem` - detailed analysis items
- `QuestionPriorityItem` - priority rankings with scoring
- `GeneratedPracticePaper` - practice paper generation

### API Routes (Already Exist)
- `POST /api/important-questions/papers` - upload papers (multipart)
- `GET /api/important-questions/papers` - list papers
- `GET /api/important-questions/papers/:id` - get paper detail
- `DELETE /api/important-questions/papers/:id` - delete paper
- `POST /api/important-questions/papers/:id` - extract/reprocess questions
- `POST /api/important-questions/analyze` - batch analyze papers
- `GET /api/important-questions/analyses` - list analyses
- `GET /api/important-questions/analyses/:id` - get analysis detail
- `DELETE /api/important-questions/analyses/:id` - delete analysis
- `GET /api/important-questions/export-pdf/:id` - export PDF

### Document Processing (Already Exist)
- `extractContent()` - unified extractor for PDF, DOCX, DOC, TXT, MD, CSV, XLSX, PPTX, images
- PDF extraction: pdf-parse → pdftotext CLI → native parser
- OCR: tesseract.js for scanned PDFs
- DOCX: native OOXML parser + mammoth fallback
- Image OCR: tesseract CLI + tesseract.js fallback

### AI Services (Already Exist)
- `resolveAIConfig()` - resolves user's AI provider config from DB/env
- `generateStructuredOutput()` - typed JSON output with validation
- `generateText()` - free-form text generation
- `getUserEmbeddingProvider()` - embeddings for semantic similarity
- Providers: OpenAI, Google Gemini, Anthropic, NVIDIA Nemotron, Groq, Mistral, OpenRouter, Together AI, Custom

### UI Components (Already Exist)
- `ImportantQuestionsNewTab.tsx` - full 3-step wizard UI (upload → analyze → results)
- `VoiceAssistant.tsx` - voice chat with history (has JSX issues)

### PDF Export (Already Exist)
- `pdfkit` based generator in `lib/study-studio/important-questions/pdf-generator.ts`
- Comprehensive multi-page reports

---

## V2 Package Architecture

### New Modules to Integrate
1. **Types** (`src/types/important-questions.ts`) - Domain contracts
2. **Text Normalization** (`src/lib/text-normalization.ts`) - Conservative normalization
3. **Question Parser** (`src/lib/question-parser.ts`) - Page-aware question extraction
4. **Analysis Engine** (`src/lib/analysis-engine.ts`) - Repeat grouping, priority scoring, study order
5. **Server Contracts** (`src/server/contracts.ts`) - Dependency ports
6. **Analyze Service** (`src/server/analyze-service.ts`) - Orchestration
7. **PDF Export** (`src/server/pdf-export.ts`) - pdf-lib based
8. **API Contracts** (`src/app/api-contracts/README.md`) - Route specifications

### Prisma Additions (Proposed)
- `ImportantQuestionDocumentV2` - V2 document storage
- `ImportantQuestionAnalysisV2` - V2 analysis storage

---

## Integration Strategy

### Phase 1: Minimal Non-Breaking Integration
1. **Add V2 modules** under `apps/web/src/lib/study-studio/important-questions-v2/` as isolated modules
2. **Adapt V2 types** to align with existing Prisma models (don't duplicate)
3. **Implement AI adapter** using existing `resolveAIConfig`, `generateStructuredOutput`, `generateText`
4. **Implement DocumentExtractor adapter** using existing `extractContent`
5. **Implement Repository adapter** using existing Prisma models
6. **Implement Storage adapter** using existing `uploadFile`/`downloadFile`

### Phase 2: API Routes (Additive)
- Add new V2 routes under `/api/study-studio/important-questions-v2/` (parallel to existing)
- Follow existing route conventions and error handling

### Phase 3: PDF Export
- Add `pdf-lib` (already in package.json) as alternative to pdfkit
- Server-side generation from persisted results only

### Phase 4: JSX Fixes
- Fix `VoiceAssistant.tsx` duplicate component definitions and closing tag issues
- Run formatter only on changed files

### Phase 5: Testing & Validation
- Run existing tests
- Run typecheck, lint, build
- Manual testing of upload, analyze, export flows

---

## Key Decisions

### Prisma Models
- **DO NOT** add new V2 models. Extend existing `QuestionPaper`, `QuestionAnalysis` with new fields if needed.
- Existing models already cover all V2 requirements.

### AI Integration
- **REUSE** existing `resolveAIConfig`, `generateStructuredOutput`, `generateText` exactly as implemented
- **NO** second AI key store
- V2 `AIAssistance` interface maps to existing AI service methods

### Document Extraction
- **REUSE** existing `extractContent` which supports all V2 formats
- **ADD** OCR reporting for scanned PDFs (already in extractors)

### PDF Export
- **USE** `pdf-lib` (already installed) for V2 export
- Keep existing `pdfkit` for backward compatibility

### API Routes
- **ADD** new V2 routes under `/api/study-studio/important-questions-v2/`
- **PRESERVE** existing V1 routes for backward compatibility
- Follow existing auth, validation, error patterns

---

## Files to Create/Modify

### New Files (V2 Modules)
1. `apps/web/src/lib/study-studio/important-questions-v2/types.ts` - V2 types adapted to existing models
2. `apps/web/src/lib/study-studio/important-questions-v2/text-normalization.ts` - From V2
3. `apps/web/src/lib/study-studio/important-questions-v2/question-parser.ts` - From V2, adapted
4. `apps/web/src/lib/study-studio/important-questions-v2/analysis-engine.ts` - From V2, adapted
5. `apps/web/src/lib/study-studio/important-questions-v2/ai-adapter.ts` - NEW: wraps existing AI service
6. `apps/web/src/lib/study-studio/important-questions-v2/document-extractor.ts` - NEW: wraps existing extractContent
7. `apps/web/src/lib/study-studio/important-questions-v2/repository.ts` - NEW: wraps existing Prisma
8. `apps/web/src/lib/study-studio/important-questions-v2/storage.ts` - NEW: wraps existing storage
9. `apps/web/src/lib/study-studio/important-questions-v2/analyze-service.ts` - From V2, adapted
10. `apps/web/src/lib/study-studio/important-questions-v2/pdf-export.ts` - From V2, adapted

### New API Routes
11. `apps/web/src/app/api/study-studio/important-questions-v2/documents/route.ts` - POST upload
12. `apps/web/src/app/api/study-studio/important-questions-v2/documents/[id]/route.ts` - DELETE
13. `apps/web/src/app/api/study-studio/important-questions-v2/analyses/route.ts` - GET list, POST create
14. `apps/web/src/app/api/study-studio/important-questions-v2/analyses/[id]/route.ts` - GET detail
15. `apps/web/src/app/api/study-studio/important-questions-v2/analyses/[id]/export/route.ts` - GET PDF

### Modified Files
16. `apps/web/src/components/voice-assistant/VoiceAssistant.tsx` - Fix JSX issues
17. `apps/web/prisma/schema.prisma` - Add any needed fields to existing models (if any)
18. `apps/web/src/components/study-studio/important-questions/ImportantQuestionsNewTab.tsx` - Optional: integrate V2 features

---

## Safety Checks

1. ✅ Git status clean before starting
2. ✅ No destructive DB operations
3. ✅ No mock AI in production
4. ✅ No second key store
5. ✅ Preserve all existing V1 routes and models
6. ✅ Use existing auth, validation, error patterns
7. ✅ Run typecheck, lint, build after changes