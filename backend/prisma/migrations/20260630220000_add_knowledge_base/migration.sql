-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('ONBOARDING', 'WHATSAPP', 'CHECKIN', 'OCCURRENCES', 'MEDICAL_CERTIFICATES', 'REPORTS', 'BILLING', 'TROUBLESHOOTING', 'FAQ', 'RELEASE_NOTES');

-- CreateEnum
CREATE TYPE "KnowledgeAudience" AS ENUM ('SUPER_ADMIN', 'ADMIN_HR', 'MANAGER', 'EMPLOYEE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL,
    "audience" "KnowledgeAudience" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" VARCHAR(500) NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "tags" TEXT[],
    "relatedUrl" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "PilotFeedback" ADD COLUMN "knowledgeArticleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_audience_idx" ON "KnowledgeArticle"("audience");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_status_idx" ON "KnowledgeArticle"("status");

-- AddForeignKey
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_knowledgeArticleId_fkey" FOREIGN KEY ("knowledgeArticleId") REFERENCES "KnowledgeArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
