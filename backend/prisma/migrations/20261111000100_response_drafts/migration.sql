-- Migração aditiva: não altera usuários, sessões ou credenciais existentes.
CREATE TYPE "ResponseReviewStatus" AS ENUM ('draft', 'needs_review', 'reviewed');

CREATE TABLE "response_template" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "questionExamples" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "answer" TEXT NOT NULL,
    "variations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reviewStatus" "ResponseReviewStatus" NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "response_template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "response_template_isActive_updatedAt_idx" ON "response_template"("isActive", "updatedAt");
CREATE INDEX "response_template_category_idx" ON "response_template"("category");
