import { ObservationReleve, StatutReleve } from '@prisma/client';

export type CounterInput = {
  c112: number;
  c113: number;
  c122: number;
  c123: number;
  c501?: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
};

export type PreviousSnapshot = {
  totalNoir: number;
  totalCouleur: number;
  c112: number;
  c113: number;
  c122: number;
  c123: number;
  c501?: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
  quotaNoirReport?: number | null;
  quotaCouleurReport?: number | null;
  /** Snapshot issu des compteurs de pose (pas un relevé mensuel). */
  fromPose?: boolean;
};

export type PrinterPoseCounters = {
  compteursInitiauxSaisis: boolean;
  dateCompteursInitiaux?: Date | string | null;
  c112Init: number;
  c113Init: number;
  c122Init: number;
  c123Init: number;
  c501Init?: number | null;
  scanNoirInit: number;
  scanCouleurInit: number;
  envoiInit: number;
};

export function printerHasPoseCounters(
  printer: Pick<PrinterPoseCounters, 'compteursInitiauxSaisis'> | null | undefined,
) {
  return !!printer?.compteursInitiauxSaisis;
}

/** Point de départ à la pose : Δ calculé au 1er relevé, quota du mois = quota de base (pas de report). */
export function poseToPreviousSnapshot(
  printer: PrinterPoseCounters,
): PreviousSnapshot {
  return {
    totalNoir: printer.c112Init + printer.c113Init,
    totalCouleur: printer.c122Init + printer.c123Init,
    c112: printer.c112Init,
    c113: printer.c113Init,
    c122: printer.c122Init,
    c123: printer.c123Init,
    c501: printer.c501Init ?? null,
    scanNoir: printer.scanNoirInit,
    scanCouleur: printer.scanCouleurInit,
    envoi: printer.envoiInit,
    quotaNoirReport: 0,
    quotaCouleurReport: 0,
    fromPose: true,
  };
}

/** Seuils métier pour alertes (Δ haut). */
export const RELEVE_THRESHOLDS = {
  deltaNoirAbsWarn: 100_000,
  deltaCouleurAbsWarn: 50_000,
  deltaVsAvgMultiplier: 3,
} as const;

/** Quota mensuel inclus (non facturable) par imprimante. */
export const QUOTA_MENSUEL = {
  noir: 1000,
  couleur: 2000,
} as const;

const RESET_MOTIFS: ObservationReleve[] = [
  ObservationReleve.RESET_COMPTEUR,
  ObservationReleve.MACHINE_REMPLACEE,
];

export function isResetMotif(motif?: ObservationReleve | null) {
  return !!motif && RESET_MOTIFS.includes(motif);
}

const NEUTRAL_MOTIFS = new Set<string>([
  ObservationReleve.RAS,
  'PRELEVEMENT_MENSUEL',
]);

export function isJustifiedMotif(motif?: ObservationReleve | null) {
  return !!motif && !NEUTRAL_MOTIFS.has(motif);
}

/** Delta du compteur 501 (total scan) entre deux relevés. */
export function scan501Brut(
  c501: number | null | undefined,
  prev501: number | null | undefined,
): number {
  if (c501 == null || prev501 == null) return 0;
  return c501 - prev501;
}

/** Applique le quota inclus : reste reporté au mois suivant. */
export function applyQuota(delta: number, dispo: number) {
  const d = Math.max(0, delta);
  const q = Math.max(0, dispo);
  const inclus = Math.min(d, q);
  return {
    inclus,
    facturer: d - inclus,
    report: q - inclus,
  };
}

export type ComputeReleveOptions = {
  motif?: ObservationReleve | null;
  avgDeltaNoir?: number | null;
  avgDeltaCouleur?: number | null;
};

function buildQuotaFields(
  deltaNoir: number,
  deltaCouleur: number,
  reportNoirIn: number,
  reportCouleurIn: number,
) {
  const quotaNoirDispo = QUOTA_MENSUEL.noir + Math.max(0, reportNoirIn);
  const quotaCouleurDispo = QUOTA_MENSUEL.couleur + Math.max(0, reportCouleurIn);
  const qN = applyQuota(deltaNoir, quotaNoirDispo);
  const qC = applyQuota(deltaCouleur, quotaCouleurDispo);
  return {
    copiesNoirDelta: deltaNoir,
    copiesCouleurDelta: deltaCouleur,
    quotaNoirDispo,
    quotaCouleurDispo,
    copiesNoirIncluses: qN.inclus,
    copiesCouleurIncluses: qC.inclus,
    quotaNoirReport: qN.report,
    quotaCouleurReport: qC.report,
    copiesNoirFacturer: qN.facturer,
    copiesCouleurFacturer: qC.facturer,
    totalCopiesFacturer: qN.facturer + qC.facturer,
  };
}

/** Totaux, Δ, quotas, Δ facturables après quota, alertes, statut. */
export function computeReleve(
  counters: CounterInput,
  previous: PreviousSnapshot | null,
  options: ComputeReleveOptions = {},
) {
  const totalNoir = counters.c112 + counters.c113;
  const totalCouleur = counters.c122 + counters.c123;

  const reportInN = previous?.quotaNoirReport ?? 0;
  const reportInC = previous?.quotaCouleurReport ?? 0;

  if (!previous) {
    const quota = buildQuotaFields(0, 0, 0, 0);
    return {
      totalNoir,
      totalCouleur,
      copiesNoirBrutes: 0,
      copiesCouleurBrutes: 0,
      scansNoirBruts: 0,
      scansCouleurBruts: 0,
      envoisBruts: 0,
      ...quota,
      scansNoirFacturer: 0,
      scansCouleurFacturer: 0,
      envoisFacturer: 0,
      alerteDeltaHaut: false,
      statut: StatutReleve.BASE_INITIALE,
      anomaly: false,
      anomalyReasons: [] as string[],
    };
  }

  const reset = isResetMotif(options.motif);
  const justified = isJustifiedMotif(options.motif);

  const delta501 = scan501Brut(counters.c501, previous.c501);
  const copiesNoirBrutes = totalNoir - previous.totalNoir;
  const copiesCouleurBrutes = totalCouleur - previous.totalCouleur + delta501;
  const scansNoirBruts = counters.scanNoir - previous.scanNoir;
  const scansCouleurBruts = counters.scanCouleur - previous.scanCouleur;
  const envoisBruts = counters.envoi - previous.envoi;

  const anomalyRaw =
    !justified &&
    (totalNoir < previous.totalNoir ||
      totalCouleur < previous.totalCouleur ||
      counters.scanNoir < previous.scanNoir ||
      counters.scanCouleur < previous.scanCouleur ||
      counters.envoi < previous.envoi ||
      counters.c112 < previous.c112 ||
      counters.c113 < previous.c113 ||
      counters.c122 < previous.c122 ||
      counters.c123 < previous.c123 ||
      (counters.c501 != null &&
        previous.c501 != null &&
        counters.c501 < previous.c501));

  // Consommation du mois (avant quota) — 501 (scan) compte dans le couleur
  const deltaNoir = reset ? totalNoir : Math.max(0, copiesNoirBrutes);
  const deltaCouleur = reset
    ? totalCouleur + (counters.c501 ?? 0)
    : Math.max(0, copiesCouleurBrutes);
  const scansNoirFacturer = reset ? counters.scanNoir : Math.max(0, scansNoirBruts);
  const scansCouleurFacturer = reset
    ? counters.scanCouleur
    : Math.max(0, scansCouleurBruts);
  const envoisFacturer = reset ? counters.envoi : Math.max(0, envoisBruts);

  const quota = buildQuotaFields(deltaNoir, deltaCouleur, reportInN, reportInC);

  const vsAvgNoir =
    options.avgDeltaNoir != null &&
    options.avgDeltaNoir > 0 &&
    deltaNoir > options.avgDeltaNoir * RELEVE_THRESHOLDS.deltaVsAvgMultiplier;
  const vsAvgCouleur =
    options.avgDeltaCouleur != null &&
    options.avgDeltaCouleur > 0 &&
    deltaCouleur > options.avgDeltaCouleur * RELEVE_THRESHOLDS.deltaVsAvgMultiplier;

  const alerteDeltaHaut =
    !anomalyRaw &&
    (deltaNoir >= RELEVE_THRESHOLDS.deltaNoirAbsWarn ||
      deltaCouleur >= RELEVE_THRESHOLDS.deltaCouleurAbsWarn ||
      !!vsAvgNoir ||
      !!vsAvgCouleur);

  let statut: StatutReleve;
  if (anomalyRaw) statut = StatutReleve.ANOMALIE_COMPTEUR;
  else if (alerteDeltaHaut) statut = StatutReleve.A_CONTROLER;
  else statut = StatutReleve.OK;

  return {
    totalNoir,
    totalCouleur,
    copiesNoirBrutes,
    copiesCouleurBrutes,
    scansNoirBruts,
    scansCouleurBruts,
    envoisBruts,
    ...quota,
    scansNoirFacturer,
    scansCouleurFacturer,
    envoisFacturer,
    alerteDeltaHaut,
    statut,
    anomaly: anomalyRaw,
    anomalyReasons: anomalyRaw
      ? explainAnomalyReasons(counters, previous)
      : [],
  };
}

/** Messages lisibles expliquant pourquoi un relevé est en ANOMALIE_COMPTEUR. */
export function explainAnomalyReasons(
  counters: CounterInput,
  previous: PreviousSnapshot,
): string[] {
  const totalNoir = counters.c112 + counters.c113;
  const totalCouleur = counters.c122 + counters.c123;
  const reasons: string[] = [];

  if (totalNoir < previous.totalNoir) {
    reasons.push(
      `Total noir en baisse (${previous.totalNoir.toLocaleString('fr-FR')} → ${totalNoir.toLocaleString('fr-FR')})`,
    );
  }
  if (totalCouleur < previous.totalCouleur) {
    reasons.push(
      `Total couleur en baisse (${previous.totalCouleur.toLocaleString('fr-FR')} → ${totalCouleur.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.c112 < previous.c112) {
    reasons.push(
      `112 (noir grand) inférieur au précédent (${previous.c112.toLocaleString('fr-FR')} → ${counters.c112.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.c113 < previous.c113) {
    reasons.push(
      `113 (noir petit) inférieur au précédent (${previous.c113.toLocaleString('fr-FR')} → ${counters.c113.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.c122 < previous.c122) {
    reasons.push(
      `122 (couleur grand) inférieur au précédent (${previous.c122.toLocaleString('fr-FR')} → ${counters.c122.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.c123 < previous.c123) {
    reasons.push(
      `123 (couleur petit) inférieur au précédent (${previous.c123.toLocaleString('fr-FR')} → ${counters.c123.toLocaleString('fr-FR')})`,
    );
  }
  if (
    counters.c501 != null &&
    previous.c501 != null &&
    counters.c501 < previous.c501
  ) {
    reasons.push(
      `501 (scan) inférieur au précédent (${previous.c501.toLocaleString('fr-FR')} → ${counters.c501.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.scanNoir < previous.scanNoir) {
    reasons.push(
      `Scan noir inférieur au précédent (${previous.scanNoir.toLocaleString('fr-FR')} → ${counters.scanNoir.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.scanCouleur < previous.scanCouleur) {
    reasons.push(
      `Scan couleur inférieur au précédent (${previous.scanCouleur.toLocaleString('fr-FR')} → ${counters.scanCouleur.toLocaleString('fr-FR')})`,
    );
  }
  if (counters.envoi < previous.envoi) {
    reasons.push(
      `Envoi inférieur au précédent (${previous.envoi.toLocaleString('fr-FR')} → ${counters.envoi.toLocaleString('fr-FR')})`,
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      'Un ou plusieurs compteurs sont inférieurs au relevé précédent (sans motif justifiant un reset).',
    );
  }
  return reasons;
}

/** Version allégée à partir des champs déjà stockés sur le relevé (liste). */
export function explainAnomalyFromStored(row: {
  totalNoir: number;
  totalCouleur: number;
  ancienTotalNoir?: number | null;
  ancienTotalCouleur?: number | null;
  ancienScanNoir?: number | null;
  ancienScanCouleur?: number | null;
  ancienEnvoi?: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
  copiesNoirBrutes?: number | null;
  copiesCouleurBrutes?: number | null;
  c501?: number | null;
}): string[] {
  const reasons: string[] = [];
  if (row.ancienTotalNoir != null && row.totalNoir < row.ancienTotalNoir) {
    reasons.push(
      `Total noir en baisse (${row.ancienTotalNoir.toLocaleString('fr-FR')} → ${row.totalNoir.toLocaleString('fr-FR')})`,
    );
  }
  if (row.ancienTotalCouleur != null && row.totalCouleur < row.ancienTotalCouleur) {
    reasons.push(
      `Total couleur en baisse (${row.ancienTotalCouleur.toLocaleString('fr-FR')} → ${row.totalCouleur.toLocaleString('fr-FR')})`,
    );
  }
  if (row.ancienScanNoir != null && row.scanNoir < row.ancienScanNoir) {
    reasons.push(
      `Scan noir en baisse (${row.ancienScanNoir.toLocaleString('fr-FR')} → ${row.scanNoir.toLocaleString('fr-FR')})`,
    );
  }
  if (row.ancienScanCouleur != null && row.scanCouleur < row.ancienScanCouleur) {
    reasons.push(
      `Scan couleur en baisse (${row.ancienScanCouleur.toLocaleString('fr-FR')} → ${row.scanCouleur.toLocaleString('fr-FR')})`,
    );
  }
  if (row.ancienEnvoi != null && row.envoi < row.ancienEnvoi) {
    reasons.push(
      `Envoi en baisse (${row.ancienEnvoi.toLocaleString('fr-FR')} → ${row.envoi.toLocaleString('fr-FR')})`,
    );
  }
  if (row.copiesNoirBrutes != null && row.copiesNoirBrutes < 0) {
    reasons.push(`Δ noir brut négatif (${row.copiesNoirBrutes.toLocaleString('fr-FR')})`);
  }
  if (row.copiesCouleurBrutes != null && row.copiesCouleurBrutes < 0) {
    reasons.push(`Δ couleur brut négatif (${row.copiesCouleurBrutes.toLocaleString('fr-FR')})`);
  }
  if (reasons.length === 0) {
    reasons.push(
      'Compteur(s) inférieur(s) au précédent — ouvrir le détail pour le diagnostic complet.',
    );
  }
  return reasons;
}

export function computeMontantLigne(params: {
  copiesNb: number;
  copiesCouleur: number;
  scansNoir: number;
  scansCouleur: number;
  envois: number;
  prixNb: number;
  prixCouleur: number;
  prixScanNoir: number;
  prixScanCouleur: number;
  prixEnvoi: number;
}) {
  const montantCopies =
    params.copiesNb * params.prixNb + params.copiesCouleur * params.prixCouleur;
  const montantScans =
    params.scansNoir * params.prixScanNoir +
    params.scansCouleur * params.prixScanCouleur +
    params.envois * params.prixEnvoi;
  return {
    montantCopies,
    montantScans,
    montantTotal: montantCopies + montantScans,
  };
}

export type StockStatut =
  | 'AUCUN_STOCK'
  | 'EN_STOCK'
  | 'PARTIELLEMENT_UTILISEE'
  | 'EPUISE'
  | 'SUR_AFFECTE';

export function computeStatutStock(
  qteEntrees: number,
  qteSorties: number,
  qteRestante: number,
): StockStatut {
  if (qteEntrees === 0 && qteSorties === 0) return 'AUCUN_STOCK';
  if (qteRestante < 0) return 'SUR_AFFECTE';
  if (qteRestante === 0) return 'EPUISE';
  if (qteSorties > 0) return 'PARTIELLEMENT_UTILISEE';
  return 'EN_STOCK';
}
