-- Add StudyMaterialJob table
-- This migration creates the study_material_jobs table required by the Important Questions V2 feature
-- The table is used to persist analysis results for the Important Questions feature

-- CreateTable: study_material_jobs
CREATE TABLE IF NOT EXISTS "study_material_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceDocId" TEXT,
    "subjectId" TEXT,
    "input" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_material_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "study_material_jobs_userId_idx" ON "study_material_jobs"("userId");
CREATE INDEX IF NOT EXISTS "study_material_jobs_status_idx" ON "study_material_jobs"("status");
CREATE INDEX IF NOT EXISTS "study_material_jobs_sourceDocId_idx" ON "study_material_jobs"("sourceDocId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "study_material_jobs" ADD CONSTRAINT "study_material_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "study_material_jobs" ADD CONSTRAINT "study_material_jobs_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "study_material_jobs" ADD CONSTRAINT "study_material_jobs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;