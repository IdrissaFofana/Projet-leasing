-- AlterTable
ALTER TABLE "Maintenance" ADD COLUMN "taches" "TypeMaintenance"[] DEFAULT ARRAY[]::"TypeMaintenance"[];

-- Backfill: chaque intervention existante reprend son type principal
UPDATE "Maintenance" SET "taches" = ARRAY["type"]::"TypeMaintenance"[] WHERE cardinality("taches") = 0;
