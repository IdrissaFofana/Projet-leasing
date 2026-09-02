import {
  applyQuota,
  computeMontantLigne,
  computeReleve,
  computeStatutStock,
  QUOTA_MENSUEL,
  scan501Brut,
} from '../src/common/domain/calculs';
import { ObservationReleve } from '@prisma/client';

describe('scan501Brut', () => {
  it('calcule le delta entre deux relevés', () => {
    expect(scan501Brut(500, 400)).toBe(100);
  });

  it('retourne 0 si valeur manquante', () => {
    expect(scan501Brut(null, 400)).toBe(0);
    expect(scan501Brut(500, null)).toBe(0);
  });
});

describe('applyQuota', () => {
  it('consomme le quota puis facture le surplus', () => {
    expect(applyQuota(3500, 2000)).toEqual({
      inclus: 2000,
      facturer: 1500,
      report: 0,
    });
  });

  it('reporte le reliquat si sous-consommation', () => {
    expect(applyQuota(400, 1000)).toEqual({
      inclus: 400,
      facturer: 0,
      report: 600,
    });
  });
});

describe('computeReleve', () => {
  const base = {
    c112: 1000,
    c113: 500,
    c122: 200,
    c123: 100,
    c501: 800,
    scanNoir: 10,
    scanCouleur: 5,
    envoi: 1,
  };

  it('premier relevé = BASE_INITIALE, Δ 0, report = quota de base', () => {
    const r = computeReleve(base, null);
    expect(r.statut).toBe('BASE_INITIALE');
    expect(r.copiesNoirDelta).toBe(0);
    expect(r.copiesNoirFacturer).toBe(0);
    expect(r.quotaNoirDispo).toBe(QUOTA_MENSUEL.noir);
    expect(r.quotaCouleurDispo).toBe(QUOTA_MENSUEL.couleur);
    expect(r.quotaNoirReport).toBe(QUOTA_MENSUEL.noir);
    expect(r.quotaCouleurReport).toBe(QUOTA_MENSUEL.couleur);
  });

  it('applique quota + report du mois précédent', () => {
    const prev = {
      totalNoir: 1500,
      totalCouleur: 300,
      c112: 1000,
      c113: 500,
      c122: 200,
      c123: 100,
      c501: 700,
      scanNoir: 10,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 1000,
      quotaCouleurReport: 2000,
    };
    // Δ papier C = 100, Δ 501 = 100 → brut couleur = 200
    const r = computeReleve(
      { ...base, c112: 1200, c113: 600, c122: 250, c123: 150, c501: 800, scanNoir: 20 },
      prev,
    );
    expect(r.statut).toBe('OK');
    expect(r.copiesNoirDelta).toBe(300);
    expect(r.copiesNoirIncluses).toBe(300);
    expect(r.copiesNoirFacturer).toBe(0);
    expect(r.quotaNoirReport).toBe(1700);
    expect(r.copiesCouleurDelta).toBe(200);
    expect(r.copiesCouleurFacturer).toBe(0);
  });

  it('facture le surplus au-delà du quota', () => {
    const prev = {
      totalNoir: 1500,
      totalCouleur: 300,
      c112: 1000,
      c113: 500,
      c122: 200,
      c123: 100,
      c501: 700,
      scanNoir: 10,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 0,
      quotaCouleurReport: 0,
    };
    const r = computeReleve(
      {
        ...base,
        c112: 3000,
        c113: 2000,
        c122: 200,
        c123: 100,
        c501: 700,
        scanNoir: 10,
      },
      prev,
    );
    expect(r.copiesNoirDelta).toBe(3500);
    expect(r.copiesNoirIncluses).toBe(1000);
    expect(r.copiesNoirFacturer).toBe(2500);
    expect(r.quotaNoirReport).toBe(0);
  });

  it('ajoute le delta 501 aux feuilles couleur', () => {
    const prev = {
      totalNoir: 1500,
      totalCouleur: 300,
      c112: 1000,
      c113: 500,
      c122: 200,
      c123: 100,
      c501: 500,
      scanNoir: 10,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 0,
      quotaCouleurReport: 0,
    };
    // papier couleur stable, scan +150
    const r = computeReleve({ ...base, c501: 650 }, prev);
    expect(r.copiesCouleurBrutes).toBe(150);
    expect(r.copiesCouleurDelta).toBe(150);
  });

  it('détecte anomalie si compteur baisse', () => {
    const prev = {
      totalNoir: 1800,
      totalCouleur: 400,
      c112: 1200,
      c113: 600,
      c122: 250,
      c123: 150,
      c501: 600,
      scanNoir: 20,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 0,
      quotaCouleurReport: 0,
    };
    const r = computeReleve({ ...base, c112: 1100, c113: 600, c122: 250, c123: 150 }, prev);
    expect(r.statut).toBe('ANOMALIE_COMPTEUR');
    expect(r.copiesNoirDelta).toBe(0);
    expect(r.copiesNoirFacturer).toBe(0);
  });

  it('détecte anomalie si 501 baisse', () => {
    const prev = {
      totalNoir: 1500,
      totalCouleur: 300,
      c112: 1000,
      c113: 500,
      c122: 200,
      c123: 100,
      c501: 800,
      scanNoir: 10,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 0,
      quotaCouleurReport: 0,
    };
    const r = computeReleve({ ...base, c501: 750 }, prev);
    expect(r.statut).toBe('ANOMALIE_COMPTEUR');
  });

  it('reset compteur : delta = totaux puis quota', () => {
    const prev = {
      totalNoir: 1800,
      totalCouleur: 400,
      c112: 1200,
      c113: 600,
      c122: 250,
      c123: 150,
      c501: 900,
      scanNoir: 20,
      scanCouleur: 5,
      envoi: 1,
      quotaNoirReport: 500,
      quotaCouleurReport: 0,
    };
    const r = computeReleve(
      { ...base, c112: 100, c113: 50, c122: 20, c123: 10, c501: 120 },
      prev,
      { motif: ObservationReleve.RESET_COMPTEUR },
    );
    expect(r.anomaly).toBe(false);
    expect(r.copiesNoirDelta).toBe(150);
    expect(r.copiesNoirFacturer).toBe(0);
    // couleur = 30 papier + 120 scan
    expect(r.copiesCouleurDelta).toBe(150);
  });
});

describe('computeMontantLigne', () => {
  it('applique tarifs N&B et couleur', () => {
    const m = computeMontantLigne({
      copiesNb: 300,
      copiesCouleur: 100,
      scansNoir: 10,
      scansCouleur: 3,
      envois: 1,
      prixNb: 75,
      prixCouleur: 10,
      prixScanNoir: 0,
      prixScanCouleur: 0,
      prixEnvoi: 0,
    });
    expect(m.montantCopies).toBe(23500);
    expect(m.montantTotal).toBe(23500);
  });
});

describe('computeStatutStock', () => {
  it('couvre les cas métier', () => {
    expect(computeStatutStock(0, 0, 0)).toBe('AUCUN_STOCK');
    expect(computeStatutStock(10, 0, 10)).toBe('EN_STOCK');
    expect(computeStatutStock(10, 3, 7)).toBe('PARTIELLEMENT_UTILISEE');
    expect(computeStatutStock(10, 10, 0)).toBe('EPUISE');
    expect(computeStatutStock(5, 8, -3)).toBe('SUR_AFFECTE');
  });
});
