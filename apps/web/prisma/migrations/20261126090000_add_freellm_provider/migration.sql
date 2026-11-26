-- Add the self-hosted FreeLLM unified gateway as a first-class AI provider.
ALTER TYPE "AIProviderType" ADD VALUE IF NOT EXISTS 'FREELLM';

-- Allow OpenAI-compatible gateways (FreeLLM, custom endpoints) to store their
-- own base URL alongside the encrypted credential instead of relying only on
-- a server-wide environment variable.
ALTER TABLE "ai_credentials" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;
