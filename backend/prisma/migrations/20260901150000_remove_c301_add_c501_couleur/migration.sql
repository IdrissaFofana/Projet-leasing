-- Suppression compteur 301 et champs de contrôle associés
ALTER TABLE "ReleveCompteur" DROP COLUMN IF EXISTS "c301";
ALTER TABLE "ReleveCompteur" DROP COLUMN IF EXISTS "ecartControle";
ALTER TABLE "ReleveCompteur" DROP COLUMN IF EXISTS "alerteEcart301";

ALTER TABLE "LigneSaisieMensuelle" DROP COLUMN IF EXISTS "c301";
