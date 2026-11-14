-- Corrective migration: Ensure study_material_jobs table exists with correct schema
-- This migration is safe to run even if the table already exists.
-- It creates the table if missing, adds missing columns, indexes, and foreign keys.

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS "public"."study_material_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "subjectId" TEXT,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_material_jobs_pkey" PRIMARY KEY ("id")
);

-- 2. Add missing columns if table exists but columns are missing
-- These ALTER TABLE ADD COLUMN IF NOT EXISTS statements are safe to run multiple times

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "sourceDocId" TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "input" JSONB NOT NULL DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "result" JSONB;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Ensure primary key exists
DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" ADD CONSTRAINT "study_material_jobs_pkey" PRIMARY KEY ("id");
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create indexes if missing
CREATE INDEX IF NOT EXISTS "study_material_jobs_userId_idx" ON "public"."study_material_jobs"("userId");
CREATE INDEX IF NOT EXISTS "study_material_jobs_status_idx" ON "public"."study_material_jobs"("status");
CREATE INDEX IF NOT EXISTS "study_material_jobs_sourceDocId_idx" ON "public"."study_material_jobs"("sourceDocId");

-- 5. Add foreign keys safely (skip if they already exist or referenced tables don't exist)
DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" 
    ADD CONSTRAINT "study_material_jobs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" 
    ADD CONSTRAINT "study_material_jobs_sourceDocId_fkey" 
    FOREIGN KEY ("sourceDocId") REFERENCES "public"."documents"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE "public"."study_material_jobs" 
    ADD CONSTRAINT "study_material_jobs_subjectId_fkey" 
    FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;