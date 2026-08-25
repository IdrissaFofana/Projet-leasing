-- CreateEnum
CREATE TYPE "StatutImprimante" AS ENUM ('FONCTIONNELLE', 'EN_MAINTENANCE', 'HORS_SERVICE', 'RETIREE');

-- CreateEnum
CREATE TYPE "CouleurToner" AS ENUM ('TONER_BLACK', 'TONER_CYAN', 'TONER_MAGENTA', 'TONER_YELLOW');

-- CreateEnum
CREATE TYPE "StatutStock" AS ENUM ('EN_STOCK', 'PARTIELLEMENT_UTILISEE', 'EPUISE', 'SUR_AFFECTE', 'AUCUN_STOCK');

-- CreateEnum
CREATE TYPE "MotifAffectation" AS ENUM ('REMPLACEMENT_NORMAL', 'TONER_VIDE', 'PANNE_IMPRESSION', 'TEST', 'URGENCE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "StatutPose" AS ENUM ('OK', 'A_REPRENDRE', 'ECHEC', 'EN_ATTENTE');

-- CreateEnum
CREATE TYPE "TypeMaintenance" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'DEPANNAGE', 'NETTOYAGE', 'REMPLACEMENT_PIECE', 'CONTROLE_PERIODIQUE');

-- CreateEnum
CREATE TYPE "StatutReleve" AS ENUM ('BASE_INITIALE', 'OK', 'ANOMALIE_COMPTEUR', 'DOUBLON_PERIODE');

-- CreateEnum
CREATE TYPE "ObservationReleve" AS ENUM ('RAS', 'RESET_COMPTEUR', 'MACHINE_REMPLACEE', 'RELEVE_ESTIME', 'CONTROLE_TECHNIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutLigneSaisie" AS ENUM ('A_SAISIR', 'PRET', 'ANOMALIE', 'DOUBLON_POSSIBLE');

-- CreateEnum
CREATE TYPE "StatutFactureLigne" AS ENUM ('A_FACTURER', 'AUCUNE_FACTURE', 'FACTUREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutFacturePeriode" AS ENUM ('BROUILLON', 'CALCULEE', 'CLOTUREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeTarif" AS ENUM ('COPIE_NB', 'COPIE_COULEUR', 'SCAN_NOIR', 'SCAN_COULEUR', 'ENVOI');

-- CreateEnum
CREATE TYPE "EntiteSequence" AS ENUM ('IMPRIMANTE', 'ENTREE_STOCK', 'AFFECTATION', 'RELEVE', 'MAINTENANCE', 'FACTURE');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN', 'TECHNICIEN', 'FACTURATION', 'LECTURE');

-- CreateTable
CREATE TABLE "Marque" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifLeasing" (
    "id" TEXT NOT NULL,
    "type" "TypeTarif" NOT NULL,
    "libelle" TEXT NOT NULL,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifLeasing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdSequenceConfig" (
    "id" TEXT NOT NULL,
    "entite" "EntiteSequence" NOT NULL,
    "prefixe" TEXT NOT NULL,
    "formatNum" TEXT NOT NULL DEFAULT '0000',
    "dernierNumero" INTEGER NOT NULL DEFAULT 0,
    "declenchement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdSequenceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL DEFAULT 'TECHNICIEN',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imprimante" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "marqueId" TEXT,
    "modele" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "localisation" TEXT,
    "statut" "StatutImprimante" NOT NULL DEFAULT 'FONCTIONNELLE',
    "fournisseurId" TEXT,
    "serviceId" TEXT,
    "dateInstallation" DATE,
    "prochaineMaintenance" DATE,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Imprimante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeleCartouche" (
    "id" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "marqueId" TEXT,
    "refFabricant" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeleCartouche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartoucheSku" (
    "id" TEXT NOT NULL,
    "modeleId" TEXT NOT NULL,
    "couleur" "CouleurToner" NOT NULL,
    "qteEntrees" INTEGER NOT NULL DEFAULT 0,
    "qteSorties" INTEGER NOT NULL DEFAULT 0,
    "qteRestante" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutStock" NOT NULL DEFAULT 'AUCUN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartoucheSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntreeStock" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dateEntree" DATE NOT NULL,
    "heureEntree" TIMESTAMP(3),
    "modeleId" TEXT NOT NULL,
    "skuId" TEXT,
    "couleur" "CouleurToner" NOT NULL,
    "qte" INTEGER NOT NULL,
    "fournisseurId" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntreeStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affectation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "datePose" DATE NOT NULL,
    "heurePose" TIMESTAMP(3),
    "imprimanteId" TEXT NOT NULL,
    "modeleId" TEXT NOT NULL,
    "agentId" TEXT,
    "motif" "MotifAffectation",
    "statutPose" "StatutPose" NOT NULL DEFAULT 'OK',
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectationLigne" (
    "id" TEXT NOT NULL,
    "affectationId" TEXT NOT NULL,
    "skuId" TEXT,
    "couleur" "CouleurToner" NOT NULL,
    "qte" INTEGER NOT NULL,

    CONSTRAINT "AffectationLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleveCompteur" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "imprimanteId" TEXT NOT NULL,
    "moisFacture" TEXT NOT NULL,
    "dateReleve" DATE NOT NULL,
    "heureReleve" TIMESTAMP(3),
    "c112" INTEGER NOT NULL DEFAULT 0,
    "c113" INTEGER NOT NULL DEFAULT 0,
    "c122" INTEGER NOT NULL DEFAULT 0,
    "c123" INTEGER NOT NULL DEFAULT 0,
    "c501" INTEGER,
    "c301" INTEGER,
    "scanNoir" INTEGER NOT NULL DEFAULT 0,
    "scanCouleur" INTEGER NOT NULL DEFAULT 0,
    "envoi" INTEGER NOT NULL DEFAULT 0,
    "totalNoir" INTEGER NOT NULL DEFAULT 0,
    "totalCouleur" INTEGER NOT NULL DEFAULT 0,
    "ancienTotalNoir" INTEGER,
    "ancienTotalCouleur" INTEGER,
    "copiesNoirFacturer" INTEGER NOT NULL DEFAULT 0,
    "copiesCouleurFacturer" INTEGER NOT NULL DEFAULT 0,
    "totalCopiesFacturer" INTEGER NOT NULL DEFAULT 0,
    "ancienScanNoir" INTEGER,
    "ancienScanCouleur" INTEGER,
    "ancienEnvoi" INTEGER,
    "scansNoirFacturer" INTEGER NOT NULL DEFAULT 0,
    "scansCouleurFacturer" INTEGER NOT NULL DEFAULT 0,
    "envoisFacturer" INTEGER NOT NULL DEFAULT 0,
    "ecartControle" INTEGER,
    "statut" "StatutReleve" NOT NULL DEFAULT 'BASE_INITIALE',
    "observationMotif" "ObservationReleve",
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleveCompteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampagneSaisie" (
    "id" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "dateReleve" DATE NOT NULL,
    "heureReleve" TEXT DEFAULT '09:00',
    "cloturee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampagneSaisie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneSaisieMensuelle" (
    "id" TEXT NOT NULL,
    "campagneId" TEXT NOT NULL,
    "imprimanteId" TEXT NOT NULL,
    "c112" INTEGER,
    "c113" INTEGER,
    "c122" INTEGER,
    "c123" INTEGER,
    "c501" INTEGER,
    "c301" INTEGER,
    "scanNoir" INTEGER,
    "scanCouleur" INTEGER,
    "envoi" INTEGER,
    "statutLigne" "StatutLigneSaisie" NOT NULL DEFAULT 'A_SAISIR',
    "observations" TEXT,
    "archiveVersReleveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneSaisieMensuelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dateMaintenance" DATE NOT NULL,
    "heureMaintenance" TIMESTAMP(3),
    "imprimanteId" TEXT NOT NULL,
    "type" "TypeMaintenance" NOT NULL,
    "technicienId" TEXT,
    "actionsRealisees" TEXT,
    "piecesConsommables" TEXT,
    "prochaineMaintenance" DATE,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturePeriode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "debutPeriode" DATE NOT NULL,
    "finPeriode" DATE NOT NULL,
    "prixNb" DECIMAL(12,2) NOT NULL,
    "prixCouleur" DECIMAL(12,2) NOT NULL,
    "prixScanNoir" DECIMAL(12,2) NOT NULL,
    "prixScanCouleur" DECIMAL(12,2) NOT NULL,
    "prixEnvoi" DECIMAL(12,2) NOT NULL,
    "montantTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "statut" "StatutFacturePeriode" NOT NULL DEFAULT 'BROUILLON',
    "clotureeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturePeriode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactureLigne" (
    "id" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "imprimanteId" TEXT NOT NULL,
    "nbReleves" INTEGER NOT NULL DEFAULT 0,
    "copiesNb" INTEGER NOT NULL DEFAULT 0,
    "copiesCouleur" INTEGER NOT NULL DEFAULT 0,
    "totalCopies" INTEGER NOT NULL DEFAULT 0,
    "scansNoir" INTEGER NOT NULL DEFAULT 0,
    "scansCouleur" INTEGER NOT NULL DEFAULT 0,
    "envois" INTEGER NOT NULL DEFAULT 0,
    "montantCopies" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montantScans" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montantTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "statut" "StatutFactureLigne" NOT NULL DEFAULT 'A_FACTURER',

    CONSTRAINT "FactureLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "dateHeure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT,
    "entiteId" TEXT,
    "details" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marque_nom_key" ON "Marque"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_nom_key" ON "Fournisseur"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_nom_key" ON "Agent"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Service_nom_key" ON "Service"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "TarifLeasing_type_key" ON "TarifLeasing"("type");

-- CreateIndex
CREATE UNIQUE INDEX "IdSequenceConfig_entite_key" ON "IdSequenceConfig"("entite");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Imprimante_code_key" ON "Imprimante"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Imprimante_numeroSerie_key" ON "Imprimante"("numeroSerie");

-- CreateIndex
CREATE INDEX "Imprimante_statut_idx" ON "Imprimante"("statut");

-- CreateIndex
CREATE INDEX "Imprimante_localisation_idx" ON "Imprimante"("localisation");

-- CreateIndex
CREATE UNIQUE INDEX "ModeleCartouche_modele_marqueId_key" ON "ModeleCartouche"("modele", "marqueId");

-- CreateIndex
CREATE UNIQUE INDEX "CartoucheSku_modeleId_couleur_key" ON "CartoucheSku"("modeleId", "couleur");

-- CreateIndex
CREATE UNIQUE INDEX "EntreeStock_code_key" ON "EntreeStock"("code");

-- CreateIndex
CREATE INDEX "EntreeStock_dateEntree_idx" ON "EntreeStock"("dateEntree");

-- CreateIndex
CREATE INDEX "EntreeStock_couleur_idx" ON "EntreeStock"("couleur");

-- CreateIndex
CREATE UNIQUE INDEX "Affectation_code_key" ON "Affectation"("code");

-- CreateIndex
CREATE INDEX "Affectation_datePose_idx" ON "Affectation"("datePose");

-- CreateIndex
CREATE INDEX "Affectation_imprimanteId_idx" ON "Affectation"("imprimanteId");

-- CreateIndex
CREATE UNIQUE INDEX "AffectationLigne_affectationId_couleur_key" ON "AffectationLigne"("affectationId", "couleur");

-- CreateIndex
CREATE UNIQUE INDEX "ReleveCompteur_code_key" ON "ReleveCompteur"("code");

-- CreateIndex
CREATE INDEX "ReleveCompteur_moisFacture_idx" ON "ReleveCompteur"("moisFacture");

-- CreateIndex
CREATE INDEX "ReleveCompteur_dateReleve_idx" ON "ReleveCompteur"("dateReleve");

-- CreateIndex
CREATE INDEX "ReleveCompteur_statut_idx" ON "ReleveCompteur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "ReleveCompteur_imprimanteId_moisFacture_key" ON "ReleveCompteur"("imprimanteId", "moisFacture");

-- CreateIndex
CREATE UNIQUE INDEX "CampagneSaisie_mois_key" ON "CampagneSaisie"("mois");

-- CreateIndex
CREATE UNIQUE INDEX "LigneSaisieMensuelle_campagneId_imprimanteId_key" ON "LigneSaisieMensuelle"("campagneId", "imprimanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Maintenance_code_key" ON "Maintenance"("code");

-- CreateIndex
CREATE INDEX "Maintenance_imprimanteId_idx" ON "Maintenance"("imprimanteId");

-- CreateIndex
CREATE INDEX "Maintenance_dateMaintenance_idx" ON "Maintenance"("dateMaintenance");

-- CreateIndex
CREATE UNIQUE INDEX "FacturePeriode_code_key" ON "FacturePeriode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FacturePeriode_mois_key" ON "FacturePeriode"("mois");

-- CreateIndex
CREATE UNIQUE INDEX "FactureLigne_periodeId_imprimanteId_key" ON "FactureLigne"("periodeId", "imprimanteId");

-- AddForeignKey
ALTER TABLE "Imprimante" ADD CONSTRAINT "Imprimante_marqueId_fkey" FOREIGN KEY ("marqueId") REFERENCES "Marque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imprimante" ADD CONSTRAINT "Imprimante_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imprimante" ADD CONSTRAINT "Imprimante_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeleCartouche" ADD CONSTRAINT "ModeleCartouche_marqueId_fkey" FOREIGN KEY ("marqueId") REFERENCES "Marque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartoucheSku" ADD CONSTRAINT "CartoucheSku_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ModeleCartouche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeStock" ADD CONSTRAINT "EntreeStock_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ModeleCartouche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeStock" ADD CONSTRAINT "EntreeStock_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "CartoucheSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntreeStock" ADD CONSTRAINT "EntreeStock_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ModeleCartouche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationLigne" ADD CONSTRAINT "AffectationLigne_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "Affectation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationLigne" ADD CONSTRAINT "AffectationLigne_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "CartoucheSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveCompteur" ADD CONSTRAINT "ReleveCompteur_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneSaisieMensuelle" ADD CONSTRAINT "LigneSaisieMensuelle_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "CampagneSaisie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneSaisieMensuelle" ADD CONSTRAINT "LigneSaisieMensuelle_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_technicienId_fkey" FOREIGN KEY ("technicienId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureLigne" ADD CONSTRAINT "FactureLigne_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "FacturePeriode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureLigne" ADD CONSTRAINT "FactureLigne_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
