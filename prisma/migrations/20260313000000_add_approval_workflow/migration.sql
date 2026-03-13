-- AlterEnum
ALTER TYPE "VideoStatus" ADD VALUE 'SCRIPT_READY';
ALTER TYPE "VideoStatus" ADD VALUE 'AUDIO_READY';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Video" ADD COLUMN "topicId" TEXT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "category" TEXT;
