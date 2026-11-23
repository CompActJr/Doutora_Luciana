-- Estruturas aditivas: preserva autenticação e respostas já cadastradas.
CREATE TABLE "knowledge_entry" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "content" TEXT NOT NULL,
    "reviewStatus" "ResponseReviewStatus" NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_entry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_entry_isActive_updatedAt_idx" ON "knowledge_entry"("isActive", "updatedAt");
CREATE INDEX "knowledge_entry_category_idx" ON "knowledge_entry"("category");

CREATE TABLE "assistant_settings" (
    "id" VARCHAR(16) NOT NULL DEFAULT 'clinic',
    "displayName" VARCHAR(80) NOT NULL,
    "introduction" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "boundaries" TEXT NOT NULL,
    "handoffTriggers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "handoffMessage" TEXT NOT NULL,
    "schedulingInstructions" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assistant_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assistant_settings_single_clinic" CHECK ("id" = 'clinic')
);
