-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL');

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'RUNNING',
    "type" "BackupType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "filename" TEXT,
    "size" BIGINT,
    "destination" TEXT,
    "errorMessage" TEXT,
    "resultKey" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Backup_resultKey_key" ON "Backup"("resultKey");

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "Backup_type_idx" ON "Backup"("type");

-- CreateIndex
CREATE INDEX "Backup_startedAt_idx" ON "Backup"("startedAt");

-- CreateIndex
CREATE INDEX "Backup_requestedById_idx" ON "Backup"("requestedById");

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
