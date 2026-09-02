export type AnnuelleConsoRow = {
  code: string;
  localisation: string;
  moisCouvert: number;
  consoN: number;
  consoC: number;
  facturerN: number;
  facturerC: number;
  depassements: number;
};

export type AnnuelleAssistanceMois = {
  mois: string;
  moisLabel: string;
  incluses: number;
  pannes: number;
  prelevements: number;
};

export type AnnuelleTypeCount = {
  type: string;
  label: string;
  count: number;
};

export type LeasingPeriodeKind = 'annuelle' | 'semestrielle' | 'trimestrielle';

export type LeasingAnnuelleHtmlView = {
  meta: {
    kind: LeasingPeriodeKind;
    annee: string;
    title: string;
    subtitle: string;
    note: string;
    client: string;
    reference: string;
    edition: string;
    periodeDebut: string;
    periodeDebutIso: string;
    periodeFin: string;
    periodeFinIso: string;
    footerBrand: string;
    syntheseLabel: string;
  };
  resume: {
    imprimantesActives: number;
    releves: number;
    interventions: number;
    assistancesIncluses: number;
    pannes: number;
    depassements: number;
    consoN: number;
    consoC: number;
    facturerN: number;
    facturerC: number;
  };
  conso: AnnuelleConsoRow[];
  assistancesParMois: AnnuelleAssistanceMois[];
  interventionsParType: AnnuelleTypeCount[];
};

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const TYPE_MAINTENANCE_LABEL: Record<string, string> = {
  ASSISTANCE: 'Assistance',
  PREVENTIVE: 'Préventive',
  CORRECTIVE: 'Corrective',
  DEPANNAGE: 'Dépannage',
  NETTOYAGE: 'Nettoyage',
  REMPLACEMENT_PIECE: 'Remplacement pièce',
  CONTROLE_PERIODIQUE: 'Contrôle périodique',
};

export function moisLabelFr(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS_FR[(m ?? 1) - 1] ?? mois} ${y}`;
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function lastDayOfMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function dayLabel(day: number, month1to12: number, year: string) {
  return `${day} ${MOIS_FR[month1to12 - 1]} ${year}`;
}

export type LeasingPeriodeSpec = {
  kind: LeasingPeriodeKind;
  annee: string;
  /** 1|2 pour semestriel ; 1..4 pour trimestriel ; ignoré pour annuel */
  index?: number;
};

export function resolveLeasingPeriode(spec: LeasingPeriodeSpec): {
  kind: LeasingPeriodeKind;
  annee: string;
  moisKeys: string[];
  title: string;
  subtitle: string;
  note: string;
  reference: string;
  syntheseLabel: string;
  periodeDebut: string;
  periodeDebutIso: string;
  periodeFin: string;
  periodeFinIso: string;
  filenameSlug: string;
  labelCourt: string;
} {
  const annee = spec.annee;
  const y = Number(annee);

  if (spec.kind === 'annuelle') {
    return {
      kind: 'annuelle',
      annee,
      moisKeys: Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}`),
      title: 'Rapport Leasing Annuel',
      subtitle: `Année ${annee}`,
      note: 'Rapport annuel de leasing — consommations, marges et interventions.',
      reference: `RPT-${annee}`,
      syntheseLabel: 'Synthèse annuelle',
      periodeDebut: dayLabel(1, 1, annee),
      periodeDebutIso: `${annee}-01-01`,
      periodeFin: dayLabel(31, 12, annee),
      periodeFinIso: `${annee}-12-31`,
      filenameSlug: `leasing-annuelle-${annee}`,
      labelCourt: `annuel ${annee}`,
    };
  }

  if (spec.kind === 'semestrielle') {
    const s = spec.index ?? 1;
    if (s !== 1 && s !== 2) throw new Error('Semestre invalide (1 ou 2)');
    const startM = s === 1 ? 1 : 7;
    const endM = s === 1 ? 6 : 12;
    const moisKeys = Array.from({ length: 6 }, (_, i) =>
      `${annee}-${String(startM + i).padStart(2, '0')}`,
    );
    const ordinal = s === 1 ? '1er' : '2e';
    return {
      kind: 'semestrielle',
      annee,
      moisKeys,
      title: 'Rapport Leasing Semestriel',
      subtitle: `${ordinal} semestre ${annee}`,
      note: 'Rapport semestriel de leasing — consommations, marges et interventions.',
      reference: `RPT-${annee}-S${s}`,
      syntheseLabel: 'Synthèse semestrielle',
      periodeDebut: dayLabel(1, startM, annee),
      periodeDebutIso: `${annee}-${String(startM).padStart(2, '0')}-01`,
      periodeFin: dayLabel(lastDayOfMonth(y, endM), endM, annee),
      periodeFinIso: `${annee}-${String(endM).padStart(2, '0')}-${String(lastDayOfMonth(y, endM)).padStart(2, '0')}`,
      filenameSlug: `leasing-semestrielle-${annee}-S${s}`,
      labelCourt: `${ordinal} semestre ${annee}`,
    };
  }

  const t = spec.index ?? 1;
  if (t < 1 || t > 4) throw new Error('Trimestre invalide (1 à 4)');
  const startM = (t - 1) * 3 + 1;
  const endM = startM + 2;
  const moisKeys = Array.from({ length: 3 }, (_, i) =>
    `${annee}-${String(startM + i).padStart(2, '0')}`,
  );
  const ordinal = t === 1 ? '1er' : `${t}e`;
  return {
    kind: 'trimestrielle',
    annee,
    moisKeys,
    title: 'Rapport Leasing Trimestriel',
    subtitle: `${ordinal} trimestre ${annee}`,
    note: 'Rapport trimestriel de leasing — consommations, marges et interventions.',
    reference: `RPT-${annee}-T${t}`,
    syntheseLabel: 'Synthèse trimestrielle',
    periodeDebut: dayLabel(1, startM, annee),
    periodeDebutIso: `${annee}-${String(startM).padStart(2, '0')}-01`,
    periodeFin: dayLabel(lastDayOfMonth(y, endM), endM, annee),
    periodeFinIso: `${annee}-${String(endM).padStart(2, '0')}-${String(lastDayOfMonth(y, endM)).padStart(2, '0')}`,
    filenameSlug: `leasing-trimestrielle-${annee}-T${t}`,
    labelCourt: `${ordinal} trimestre ${annee}`,
  };
}

type ReleveLite = {
  moisFacture: string;
  copiesNoirDelta?: number | null;
  copiesCouleurDelta?: number | null;
  copiesNoirFacturer?: number | null;
  copiesCouleurFacturer?: number | null;
  quotaNoirReport?: number | null;
  quotaCouleurReport?: number | null;
  quotaNoirDispo?: number | null;
  quotaCouleurDispo?: number | null;
  imprimante: { code: string; localisation: string | null };
};

type MaintLite = {
  type: string;
  moisAssistance: string | null;
  horsQuota: boolean;
  releveId: string | null;
  taches?: string[];
};

export function mapToAnnuelleView(input: {
  periode: ReturnType<typeof resolveLeasingPeriode>;
  clientNom: string;
  releves: ReleveLite[];
  maintenances: MaintLite[];
  imprimantesActives: number;
}): LeasingAnnuelleHtmlView {
  const { periode } = input;
  const byPrinter = new Map<
    string,
    {
      code: string;
      localisation: string;
      mois: Set<string>;
      consoN: number;
      consoC: number;
      facturerN: number;
      facturerC: number;
      depassements: number;
    }
  >();

  let depassements = 0;
  let consoN = 0;
  let consoC = 0;
  let facturerN = 0;
  let facturerC = 0;

  for (const r of input.releves) {
    const key = r.imprimante.code;
    const n = r.copiesNoirDelta ?? 0;
    const c = r.copiesCouleurDelta ?? 0;
    const fn = r.copiesNoirFacturer ?? 0;
    const fc = r.copiesCouleurFacturer ?? 0;
    const quotaN = r.quotaNoirDispo ?? 1000;
    const quotaC = r.quotaCouleurDispo ?? 2000;
    const margeN = r.quotaNoirReport != null ? r.quotaNoirReport : quotaN - n;
    const margeC = r.quotaCouleurReport != null ? r.quotaCouleurReport : quotaC - c;
    const dep = margeN < 0 || margeC < 0;
    if (dep) depassements += 1;
    consoN += n;
    consoC += c;
    facturerN += fn;
    facturerC += fc;

    const cur = byPrinter.get(key) ?? {
      code: r.imprimante.code,
      localisation: r.imprimante.localisation ?? '—',
      mois: new Set<string>(),
      consoN: 0,
      consoC: 0,
      facturerN: 0,
      facturerC: 0,
      depassements: 0,
    };
    cur.mois.add(r.moisFacture);
    cur.consoN += n;
    cur.consoC += c;
    cur.facturerN += fn;
    cur.facturerC += fc;
    if (dep) cur.depassements += 1;
    byPrinter.set(key, cur);
  }

  const conso = [...byPrinter.values()]
    .map((p) => ({
      code: p.code,
      localisation: p.localisation,
      moisCouvert: p.mois.size,
      consoN: p.consoN,
      consoC: p.consoC,
      facturerN: p.facturerN,
      facturerC: p.facturerC,
      depassements: p.depassements,
    }))
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'));

  const assistancesParMois = periode.moisKeys.map((mois) => {
    const ofMonth = input.maintenances.filter(
      (m) =>
        m.moisAssistance === mois &&
        (m.type === 'ASSISTANCE' || (m.taches ?? []).includes('ASSISTANCE')),
    );
    return {
      mois,
      moisLabel: moisLabelFr(mois),
      incluses: ofMonth.filter((m) => !m.horsQuota && !m.releveId).length,
      pannes: ofMonth.filter((m) => m.horsQuota).length,
      prelevements: ofMonth.filter((m) => !!m.releveId).length,
    };
  });

  const typeMap = new Map<string, number>();
  for (const m of input.maintenances) {
    const list = m.taches?.length ? m.taches : [m.type];
    for (const t of list) {
      typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
    }
  }
  const interventionsParType = [...typeMap.entries()]
    .map(([type, count]) => ({
      type,
      label: TYPE_MAINTENANCE_LABEL[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const assistancesIncluses = input.maintenances.filter(
    (m) =>
      (m.type === 'ASSISTANCE' || (m.taches ?? []).includes('ASSISTANCE')) &&
      !m.horsQuota &&
      !m.releveId,
  ).length;
  const pannes = input.maintenances.filter((m) => m.horsQuota).length;

  return {
    meta: {
      kind: periode.kind,
      annee: periode.annee,
      title: periode.title,
      subtitle: periode.subtitle,
      note: periode.note,
      client: input.clientNom,
      reference: periode.reference,
      edition: new Date().toLocaleDateString('fr-FR'),
      periodeDebut: periode.periodeDebut,
      periodeDebutIso: periode.periodeDebutIso,
      periodeFin: periode.periodeFin,
      periodeFinIso: periode.periodeFinIso,
      footerBrand: 'Ivoprest',
      syntheseLabel: periode.syntheseLabel,
    },
    resume: {
      imprimantesActives: input.imprimantesActives,
      releves: input.releves.length,
      interventions: input.maintenances.length,
      assistancesIncluses,
      pannes,
      depassements,
      consoN,
      consoC,
      facturerN,
      facturerC,
    },
    conso,
    assistancesParMois,
    interventionsParType,
  };
}
