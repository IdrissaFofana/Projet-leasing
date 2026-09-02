import { Prisma, TypeMaintenance } from '@prisma/client';

/** Quota contractuel : 1 assistance incluse / copieur / mois civil (hors prélèvements compteur). */
export const ASSISTANCES_PAR_MOIS = 1;

type Db = Prisma.TransactionClient | {
  maintenanceImprimante: Prisma.TransactionClient['maintenanceImprimante'];
};

/** Filtre Prisma : assistances manuelles comptées dans le quota (pas panne, pas prélèvement). */
export function whereAssistanceDansQuota(mois: string): Prisma.MaintenanceWhereInput {
  return {
    type: TypeMaintenance.ASSISTANCE,
    moisAssistance: mois,
    horsQuota: false,
    releveId: null,
  };
}

export async function countAssistancesParImprimante(
  db: Db,
  mois: string,
  opts?: { horsQuota?: boolean },
): Promise<Map<string, number>> {
  const where: Prisma.MaintenanceWhereInput = {
    type: TypeMaintenance.ASSISTANCE,
    moisAssistance: mois,
  };
  if (opts?.horsQuota === true) {
    where.horsQuota = true;
  } else if (opts?.horsQuota === false) {
    Object.assign(where, whereAssistanceDansQuota(mois));
  }

  const links = await db.maintenanceImprimante.findMany({
    where: { maintenance: where },
    select: { imprimanteId: true },
  });

  const map = new Map<string, number>();
  for (const link of links) {
    map.set(link.imprimanteId, (map.get(link.imprimanteId) ?? 0) + 1);
  }
  return map;
}

/** Prélèvements compteur (assistances auto liées à un relevé) — hors quota. */
export async function countPrelevementsParImprimante(
  db: Db,
  mois: string,
): Promise<Map<string, number>> {
  const links = await db.maintenanceImprimante.findMany({
    where: {
      maintenance: {
        type: TypeMaintenance.ASSISTANCE,
        moisAssistance: mois,
        releveId: { not: null },
      },
    },
    select: { imprimanteId: true },
  });

  const map = new Map<string, number>();
  for (const link of links) {
    map.set(link.imprimanteId, (map.get(link.imprimanteId) ?? 0) + 1);
  }
  return map;
}
