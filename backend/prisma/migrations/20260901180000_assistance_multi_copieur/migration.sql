-- Assistance : multi-copieurs + panne hors quota + quota 1/mois
ALTER TABLE "Maintenance" ADD COLUMN "horsQuota" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MaintenanceImprimante" (
    "id" TEXT NOT NULL,
    "maintenanceId" TEXT NOT NULL,
    "imprimanteId" TEXT NOT NULL,

    CONSTRAINT "MaintenanceImprimante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaintenanceImprimante_maintenanceId_imprimanteId_key" ON "MaintenanceImprimante"("maintenanceId", "imprimanteId");
CREATE INDEX "MaintenanceImprimante_imprimanteId_idx" ON "MaintenanceImprimante"("imprimanteId");

ALTER TABLE "MaintenanceImprimante" ADD CONSTRAINT "MaintenanceImprimante_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "Maintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceImprimante" ADD CONSTRAINT "MaintenanceImprimante_imprimanteId_fkey" FOREIGN KEY ("imprimanteId") REFERENCES "Imprimante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MaintenanceImprimante" ("id", "maintenanceId", "imprimanteId")
SELECT
  'mi_' || "id",
  "id",
  "imprimanteId"
FROM "Maintenance";
