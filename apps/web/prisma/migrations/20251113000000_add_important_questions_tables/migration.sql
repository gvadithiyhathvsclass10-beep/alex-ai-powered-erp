-- Add Important Questions tables
-- This migration adds the tables required for the Important Questions feature
-- DocumentStatus enum already exists in the database (created by earlier migrations)

-- CreateTable: question_papers
CREATE TABLE IF NOT EXISTS "question_papers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL DEFAULT 'documents',
    "paperType" TEXT NOT NULL,
    "subjectId" TEXT,
    "semester" TEXT,
    "unit" TEXT,
    "academicYear" TEXT,
    "examinationYear" INTEGER,
    "marks" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "pageCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: extracted_questions
CREATE TABLE IF NOT EXISTS "extracted_questions" (
    "id" TEXT NOT NULL,
    "questionPaperId" TEXT NOT NULL,
    "questionNumber" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "subQuestions" JSONB,
    "marks" INTEGER,
    "unit" TEXT,
    "topic" TEXT,
    "concept" TEXT,
    "questionType" TEXT,
    "difficulty" TEXT,
    "year" INTEGER,
    "pageReference" INTEGER,
    "extractionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "flags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: question_analyses
CREATE TABLE IF NOT EXISTS "question_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "paperIds" TEXT[] NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "exactRepeats" INTEGER NOT NULL,
    "semanticRepeats" INTEGER NOT NULL,
    "analysisData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: question_analysis_items
CREATE TABLE IF NOT EXISTS "question_analysis_items" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "papersCount" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "avgMarks" DOUBLE PRECISION NOT NULL,
    "firstYear" INTEGER,
    "lastYear" INTEGER,
    "units" TEXT[],
    "topics" TEXT[],
    "concepts" TEXT[],
    "questionTypes" TEXT[],
    "priority" TEXT NOT NULL,
    "priorityReason" TEXT NOT NULL,
    "isExactRepeat" BOOLEAN NOT NULL DEFAULT false,
    "matchedQuestionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_analysis_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: question_priority_items
CREATE TABLE IF NOT EXISTS "question_priority_items" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "recencyScore" DOUBLE PRECISION NOT NULL,
    "marksWeight" DOUBLE PRECISION NOT NULL,
    "unitRelevance" DOUBLE PRECISION NOT NULL,
    "papersCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_priority_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: generated_practice_papers
CREATE TABLE IF NOT EXISTS "generated_practice_papers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceAnalysisId" TEXT,
    "paperType" TEXT NOT NULL,
    "subjectId" TEXT,
    "unit" TEXT,
    "questions" JSONB NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_practice_papers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_papers_userId_idx" ON "question_papers"("userId");
CREATE INDEX IF NOT EXISTS "question_papers_subjectId_idx" ON "question_papers"("subjectId");
CREATE INDEX IF NOT EXISTS "question_papers_paperType_idx" ON "question_papers"("paperType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "extracted_questions_questionPaperId_idx" ON "extracted_questions"("questionPaperId");
CREATE INDEX IF NOT EXISTS "extracted_questions_topic_idx" ON "extracted_questions"("topic");
CREATE INDEX IF NOT EXISTS "extracted_questions_concept_idx" ON "extracted_questions"("concept");
CREATE INDEX IF NOT EXISTS "extracted_questions_unit_idx" ON "extracted_questions"("unit");
CREATE INDEX IF NOT EXISTS "extracted_questions_year_idx" ON "extracted_questions"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_analyses_userId_idx" ON "question_analyses"("userId");
CREATE INDEX IF NOT EXISTS "question_analyses_subjectId_idx" ON "question_analyses"("subjectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_analysis_items_analysisId_idx" ON "question_analysis_items"("analysisId");
CREATE INDEX IF NOT EXISTS "question_analysis_items_priority_idx" ON "question_analysis_items"("priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_priority_items_analysisId_idx" ON "question_priority_items"("analysisId");
CREATE INDEX IF NOT EXISTS "question_priority_items_priority_idx" ON "question_priority_items"("priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "generated_practice_papers_userId_idx" ON "generated_practice_papers"("userId");
CREATE INDEX IF NOT EXISTS "generated_practice_papers_sourceAnalysisId_idx" ON "generated_practice_papers"("sourceAnalysisId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "question_analyses" ADD CONSTRAINT "question_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "question_analyses" ADD CONSTRAINT "question_analyses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "question_analysis_items" ADD CONSTRAINT "question_analysis_items_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "question_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "question_priority_items" ADD CONSTRAINT "question_priority_items_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "question_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "generated_practice_papers" ADD CONSTRAINT "generated_practice_papers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "generated_practice_papers" ADD CONSTRAINT "generated_practice_papers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;