ALTER TABLE "LigneSaisieMensuelle" ADD COLUMN IF NOT EXISTS "rapportPath" TEXT;
ALTER TABLE "LigneSaisieMensuelle" ADD COLUMN IF NOT EXISTS "rapportNom" TEXT;
ALTER TABLE "LigneSaisieMensuelle" ADD COLUMN IF NOT EXISTS "rapportMime" TEXT;
