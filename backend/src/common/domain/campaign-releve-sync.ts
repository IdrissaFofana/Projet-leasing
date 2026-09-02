import {
  Prisma,
  ReleveCompteur,
  StatutLigneSaisie,
  StatutReleve,
} from '@prisma/client';
import * as fs from 'fs';
import {
  absoluteUploadPath,
  saveReportFile,
} from '../upload/report-files';

export type ReleveCounterFields = Pick<
  ReleveCompteur,
  | 'c112'
  | 'c113'
  | 'c122'
  | 'c123'
  | 'c501'
  | 'scanNoir'
  | 'scanCouleur'
  | 'envoi'
  | 'observationMotif'
  | 'observations'
  | 'code'
  | 'statut'
  | 'id'
>;

export function countersFromReleve(releve: ReleveCounterFields) {
  return {
    c112: releve.c112,
    c113: releve.c113,
    c122: releve.c122,
    c123: releve.c123,
    c501: releve.c501,
    scanNoir: releve.scanNoir,
    scanCouleur: releve.scanCouleur,
    envoi: releve.envoi,
    observationMotif: releve.observationMotif,
  };
}

export function statutLigneForLinkedReleve(statutReleve: StatutReleve): StatutLigneSaisie {
  if (statutReleve === StatutReleve.ANOMALIE_COMPTEUR) {
    return StatutLigneSaisie.ANOMALIE;
  }
  return StatutLigneSaisie.PRET;
}

/** Données ligne campagne pré-remplies et liées à un relevé existant. */
export function buildLigneDataFromReleve(
  imprimanteId: string,
  releve: ReleveCounterFields,
): Prisma.LigneSaisieMensuelleUncheckedCreateWithoutCampagneInput {
  return {
    imprimanteId,
    ...countersFromReleve(releve),
    observations: releve.observations ?? `Lie au releve ${releve.code}`,
    archiveVersReleveId: releve.id,
    statutLigne: statutLigneForLinkedReleve(releve.statut),
  };
}

/** Mise à jour d'une ligne campagne depuis un relevé officiel. */
export function buildLigneUpdateFromReleve(
  releve: ReleveCounterFields,
): Prisma.LigneSaisieMensuelleUpdateInput {
  return {
    ...countersFromReleve(releve),
    observations: releve.observations ?? `Lie au releve ${releve.code}`,
    archiveVersReleveId: releve.id,
    statutLigne: statutLigneForLinkedReleve(releve.statut),
  };
}

const OPEN_LIGNE_STATUTS: StatutLigneSaisie[] = [
  StatutLigneSaisie.A_SAISIR,
  StatutLigneSaisie.BROUILLON,
  StatutLigneSaisie.PRET,
];

/** Clôture la campagne si toutes les lignes ouvertes sont liées à un relevé. */
export async function maybeCloseCampagne(
  tx: Prisma.TransactionClient,
  campagneId: string,
) {
  const remaining = await tx.ligneSaisieMensuelle.count({
    where: {
      campagneId,
      archiveVersReleveId: null,
      statutLigne: { in: OPEN_LIGNE_STATUTS },
    },
  });
  if (remaining === 0) {
    await tx.campagneSaisie.update({
      where: { id: campagneId },
      data: { cloturee: true },
    });
  }
}

/** Relie la ligne campagne correspondante après création d'un relevé direct. */
export async function syncCampagneLigneFromReleve(
  tx: Prisma.TransactionClient,
  releve: ReleveCompteur,
) {
  const campagne = await tx.campagneSaisie.findUnique({
    where: { mois: releve.moisFacture },
  });
  if (!campagne || campagne.cloturee) return;

  const ligne = await tx.ligneSaisieMensuelle.findUnique({
    where: {
      campagneId_imprimanteId: {
        campagneId: campagne.id,
        imprimanteId: releve.imprimanteId,
      },
    },
  });
  if (!ligne) return;
  if (ligne.archiveVersReleveId === releve.id) return;

  await tx.ligneSaisieMensuelle.update({
    where: { id: ligne.id },
    data: buildLigneUpdateFromReleve(releve),
  });

  await maybeCloseCampagne(tx, campagne.id);
}

/** Copie le rapport d'une ligne campagne vers le relevé officiel (si le relevé n'en a pas). */
export async function transferLigneRapportToReleve(
  tx: Prisma.TransactionClient,
  ligne: {
    id: string;
    rapportPath: string | null;
    rapportNom: string | null;
    rapportMime: string | null;
  },
  releveId: string,
) {
  if (!ligne.rapportPath) return;

  const releve = await tx.releveCompteur.findUnique({ where: { id: releveId } });
  if (!releve || releve.rapportPath) return;

  const src = absoluteUploadPath(ligne.rapportPath);
  if (!fs.existsSync(src)) return;

  const buffer = fs.readFileSync(src);
  const saved = saveReportFile('releves', {
    buffer,
    mimetype: ligne.rapportMime ?? 'application/pdf',
    originalname: ligne.rapportNom ?? 'rapport-compteur.pdf',
    size: buffer.length,
  } as Express.Multer.File);

  await tx.releveCompteur.update({
    where: { id: releveId },
    data: {
      rapportPath: saved.relativePath,
      rapportNom: saved.originalName,
      rapportMime: saved.mime,
    },
  });

  try {
    fs.unlinkSync(src);
  } catch {
    /* ignore */
  }

  await tx.ligneSaisieMensuelle.update({
    where: { id: ligne.id },
    data: { rapportPath: null, rapportNom: null, rapportMime: null },
  });
}
