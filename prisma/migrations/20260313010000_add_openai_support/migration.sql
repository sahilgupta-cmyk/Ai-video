-- AlterTable
ALTER TABLE "User" ADD COLUMN "openaiApiKey" TEXT;
ALTER TABLE "User" ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'claude';
