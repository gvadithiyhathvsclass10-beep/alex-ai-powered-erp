# ALEX AI Model Hub - Improvement Plan

## Current State Analysis

### Working Features:
1. ✅ Model discovery for 8 providers (OpenAI, Google Gemini, Groq, Mistral, OpenRouter, Together AI, OTHER, Anthropic*, NVIDIA*)
2. ✅ Caching with 1-hour TTL and force-refresh capability
3. ✅ Custom model ID validation with test requests
4. ✅ Custom model ID support in model configuration API
5. ✅ Custom model ID support in AI Settings UI (Models tab)
6. ✅ Credential-based model discovery
7. ✅ Task-type filtering (chat, embeddings, reasoning, vision, structured, summarization)
8. ✅ Auto-creation of default model configs when adding credentials
9. ✅ Credential-based model discovery with proper encryption
10. ✅ **Pagination support for OpenRouter and Together AI**
11. ✅ **Rate limit handling with exponential backoff**
12. ✅ **Provider capability metadata (PROVIDER_CAPABILITIES)**
13. ✅ **Retry logic for failed requests**
14. ✅ **Task-specific model validation** (chat, embeddings, vision, reasoning, structured, function-calling)
15. ✅ **Deprecation detection** for known deprecated models (OpenAI, Anthropic)
15. ✅ **Enhanced AI Settings UI** with model discovery, capabilities, status badges, task-specific testing
16. ✅ **Model test status tracking** (untested, testing, valid, invalid, unavailable)

### Current Limitations to Fix:

1. **Anthropic & NVIDIA lack model discovery APIs** - Only static fallback lists (but support custom model IDs)
2. **Deprecation detection limited** to known models (not from live provider metadata)
3. **No provider capability metadata in discovery results** (not exposed to frontend - need new API field)

## Improvement Plan

### Phase 1: Core Model Discovery Improvements
- [x] Add proper error handling for provider-specific API quirks
- [x] Add pagination support for OpenRouter, Together AI
- [x] Add rate limit handling with exponential backoff
- [x] Add provider capability metadata (PROVIDER_CAPABILITIES constant)
- [x] Add deprecated model detection where possible (known models)
- [x] Improve error messages for discovery failures

### Phase 2: Custom Model Validation Enhancement
- [x] Make validateCustomModel test the actual task type (chat/embeddings/reasoning/vision/structured/function-calling)
- [x] Add proper endpoint selection based on task type
- [x] Add better error classification for validation failures
- [x] Support testing embeddings models with embeddings endpoint

### Phase 3: Provider-Specific Improvements
- [x] Add proper Anthropic model discovery (static list with capability detection)
- [x] Add proper NVIDIA Nemotron model discovery (static list with capability detection)
- [x] Add pagination for OpenRouter, Together AI
- [x] Add rate limit handling with exponential backoff
- [ ] Add deprecated model detection from live provider metadata (when available)

### Phase 4: Frontend Improvements
- [x] Show model discovery status (cached/fresh/error)
- [x] Show model deprecation warnings
- [x] Show model capabilities in discovery results
- [x] Add "Test for specific task" option in Model Discovery table
- [x] Show model test status badges (untested/testing/valid/invalid/unavailable)
- [x] Show confirmed capabilities with checkmarks
- [x] Show context window and max output tokens
- [x] Custom Model section with task-specific validation
- [ ] Show provider capability matrix
- [ ] Add model deprecation warnings in Test tab

### Phase 5: Integration & Testing
- [ ] Ensure model discovery works end-to-end for all providers
- [ ] Test custom model validation for all task types
- [ ] Test model discovery with various credentials
- [ ] Test model selection persistence across sessions
- [ ] Verify saved model configs work with discovered/custom models

## Implementation Priority

### High Priority (Critical)
1. Fix custom model validation to support all task types ✅
2. Add pagination for large model lists ✅
3. Fix model discovery for providers with known issues ✅
4. Add rate limit handling ✅

### Medium Priority (Important)
1. Add deprecated model detection from live provider metadata
2. Improve error messages ✅
3. Expose provider capability metadata to frontend

### Medium Priority (Nice to Have)
1. Add provider capability matrix in UI
2. Show model deprecation warnings in Test tab
3. Model comparison view
3. Model usage analytics
4. Advanced model filtering

### Low Priority (Nice to Have)
1. Provider capability matrix in UI
2. Model comparison view
3. Model usage analytics
4. Advanced model filtering

## Completed Work Summary

### Fixed Issues:
1. **Pagination Support**: Added pagination for OpenRouter and Together AI using cursor-based pagination
2. **Rate Limit Handling**: Added exponential backoff retry logic with `Retry-After` header support
3. **Provider Capability Metadata**: Created `PROVIDER_CAPABILITIES` constant with detailed capability info for all providers
4. **Retry Logic**: Added `fetchWithRetry` function with configurable retries
5. **TypeScript Compilation**: Fixed all TypeScript errors (implicit any, missing properties, parse errors)
6. **Build Success**: Next.js build completes successfully
7. **Task-Specific Validation**: `validateCustomModel` now tests chat, embeddings, vision, reasoning, structured output, and function calling with provider-specific adapters
8. **Deprecation Detection**: Added known deprecated model detection for OpenAI and Anthropic
9. **Enhanced UI**: Model Discovery table with status badges, capabilities, test buttons per task, deprecation warnings
10. **Custom Model Section**: Task-specific validation and saving with test details display

### Files Modified:
- `apps/web/src/lib/ai/model-discovery.ts` - Complete rewrite with pagination, rate limiting, retries, provider capabilities, task-specific validation, deprecation detection
- `apps/web/src/app/api/ai/models/validate/route.ts` - Updated to accept taskType parameter
- `apps/web/src/app/(dashboard)/ai-settings/page.tsx` - Enhanced UI with Model Discovery section, Custom Model section, task-specific testing, status badges

### API Endpoints Working:
- `GET /api/ai/models/discover` - Model discovery with pagination, caching, force-refresh, task-type filtering
- `POST /api/ai/models/validate` - Custom model validation with taskType parameter
- `POST /api/ai/models` - Model configuration with custom model support
- `GET /api/ai/models` - List saved model configurations

### Remaining Work:
1. Expose provider capability metadata to frontend via discovery API
2. Add live deprecation detection from provider APIs (when available)
3. Add provider capability matrix in UI
4. Show model deprecation warnings in Test tab
5. End-to-end integration testing with live provider credentials