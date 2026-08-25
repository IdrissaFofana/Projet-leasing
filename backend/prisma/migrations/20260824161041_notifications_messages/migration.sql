-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STOCK_BAS', 'STOCK_EPUISE', 'ANOMALIE_RELEVE', 'MAINTENANCE_PROCHE', 'FACTURATION', 'CAMPAGNE', 'SYSTEME', 'MESSAGE');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lien" TEXT,
    "fingerprint" TEXT NOT NULL,
    "luAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageInterne" (
    "id" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "luAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageInterne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_luAt_idx" ON "Notification"("userId", "luAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_fingerprint_key" ON "Notification"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "MessageInterne_destinataireId_createdAt_idx" ON "MessageInterne"("destinataireId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageInterne_expediteurId_createdAt_idx" ON "MessageInterne"("expediteurId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageInterne_destinataireId_luAt_idx" ON "MessageInterne"("destinataireId", "luAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageInterne" ADD CONSTRAINT "MessageInterne_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageInterne" ADD CONSTRAINT "MessageInterne_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
