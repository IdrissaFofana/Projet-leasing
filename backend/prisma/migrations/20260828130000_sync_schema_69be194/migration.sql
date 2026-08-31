-- CreateEnum
CREATE TYPE "StatutStockProduit" AS ENUM ('RECEPTION_EN_ATTENTE', 'EN_STOCK', 'PARTIELLEMENT_LIVRE', 'LIVRE', 'ANNULE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSISTANCE_QUOTA';

-- AlterEnum
ALTER TYPE "StatutLigneSaisie" ADD VALUE 'BROUILLON';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutReleve" ADD VALUE 'BROUILLON';
ALTER TYPE "StatutReleve" ADD VALUE 'SAISI';
ALTER TYPE "StatutReleve" ADD VALUE 'A_CONTROLER';
ALTER TYPE "StatutReleve" ADD VALUE 'CONTROLE';
ALTER TYPE "StatutReleve" ADD VALUE 'VALIDE';

-- AlterEnum
ALTER TYPE "TypeMaintenance" ADD VALUE 'ASSISTANCE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAdresse" TEXT,
ADD COLUMN     "resultat" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "LigneSaisieMensuelle" ADD COLUMN     "observationMotif" "ObservationReleve";

-- AlterTable
ALTER TABLE "Maintenance" ADD COLUMN     "assigneeUserId" TEXT,
ADD COLUMN     "moisAssistance" TEXT,
ADD COLUMN     "rapportMime" TEXT,
ADD COLUMN     "rapportNom" TEXT,
ADD COLUMN     "rapportPath" TEXT,
ADD COLUMN     "releveId" TEXT;

-- AlterTable
ALTER TABLE "ReleveCompteur" ADD COLUMN     "alerteDeltaHaut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alerteEcart301" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "controleAt" TIMESTAMP(3),
ADD COLUMN     "controleParId" TEXT,
ADD COLUMN     "copiesCouleurBrutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "copiesCouleurDelta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "copiesCouleurIncluses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "copiesNoirBrutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "copiesNoirDelta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "copiesNoirIncluses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "envoisBruts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotaCouleurDispo" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "quotaCouleurReport" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotaNoirDispo" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "quotaNoirReport" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rapportMime" TEXT,
ADD COLUMN     "rapportNom" TEXT,
ADD COLUMN     "rapportPath" TEXT,
ADD COLUMN     "scansCouleurBruts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scansNoirBruts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valideAt" TIMESTAMP(3),
ADD COLUMN     "valideParId" TEXT;

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "roleMetierId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMetier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "systeme" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleMetier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleveAudit" (
    "id" TEXT NOT NULL,
    "releveId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleveAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockProduit" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "reference" TEXT,
    "fournisseur" TEXT,
    "qteRecue" INTEGER NOT NULL DEFAULT 0,
    "dateReception" DATE,
    "bonReception" TEXT,
    "qteLivree" INTEGER NOT NULL DEFAULT 0,
    "dateLivraison" DATE,
    "destinataire" TEXT,
    "clientId" TEXT,
    "bonLivraison" TEXT,
    "statut" "StatutStockProduit" NOT NULL DEFAULT 'RECEPTION_EN_ATTENTE',
    "statutManuel" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_nom_key" ON "Client"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMetier_code_key" ON "RoleMetier"("code");

-- CreateIndex
CREATE INDEX "ReleveAudit_releveId_createdAt_idx" ON "ReleveAudit"("releveId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockProduit_numero_key" ON "StockProduit"("numero");

-- CreateIndex
CREATE INDEX "StockProduit_statut_idx" ON "StockProduit"("statut");

-- CreateIndex
CREATE INDEX "StockProduit_dateReception_idx" ON "StockProduit"("dateReception");

-- CreateIndex
CREATE INDEX "StockProduit_destinataire_idx" ON "StockProduit"("destinataire");

-- CreateIndex
CREATE INDEX "StockProduit_clientId_idx" ON "StockProduit"("clientId");

-- CreateIndex
CREATE INDEX "StockProduit_fournisseur_idx" ON "StockProduit"("fournisseur");

-- CreateIndex
CREATE INDEX "StockProduit_designation_idx" ON "StockProduit"("designation");

-- CreateIndex
CREATE INDEX "AuditLog_dateHeure_idx" ON "AuditLog"("dateHeure");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entite_idx" ON "AuditLog"("entite");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Maintenance_releveId_key" ON "Maintenance"("releveId");

-- CreateIndex
CREATE INDEX "Maintenance_moisAssistance_idx" ON "Maintenance"("moisAssistance");

-- CreateIndex
CREATE INDEX "Maintenance_type_moisAssistance_idx" ON "Maintenance"("type", "moisAssistance");

-- CreateIndex
CREATE INDEX "Maintenance_assigneeUserId_idx" ON "Maintenance"("assigneeUserId");

-- CreateIndex
CREATE INDEX "Utilisateur_roleMetierId_idx" ON "Utilisateur"("roleMetierId");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_roleMetierId_fkey" FOREIGN KEY ("roleMetierId") REFERENCES "RoleMetier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveAudit" ADD CONSTRAINT "ReleveAudit_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "ReleveCompteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "ReleveCompteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockProduit" ADD CONSTRAINT "StockProduit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

