-- Add UNIVERSAL_GATEWAY to AIProviderType enum and gateway fields to AICredential

-- Alter enum to add UNIVERSAL_GATEWAY
ALTER TYPE "AIProviderType" ADD VALUE IF NOT EXISTS 'UNIVERSAL_GATEWAY';

-- Add gateway fields to AICredential
ALTER TABLE "ai_credentials" ADD COLUMN IF NOT EXISTS "gatewayType" TEXT;
ALTER TABLE "ai_credentials" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;

-- Add index on userId + gatewayType for efficient gateway credential lookups
CREATE INDEX IF NOT EXISTS "ai_credentials_userId_gatewayType_idx" ON "ai_credentials"("userId", "gatewayType");