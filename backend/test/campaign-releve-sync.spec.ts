import {
  buildLigneDataFromReleve,
  statutLigneForLinkedReleve,
} from '../src/common/domain/campaign-releve-sync';
import { StatutLigneSaisie, StatutReleve } from '@prisma/client';

describe('campaign-releve-sync', () => {
  const releve = {
    id: 'rel-1',
    code: 'REL-0042',
    statut: StatutReleve.OK,
    c112: 100,
    c113: 50,
    c122: 20,
    c123: 10,
    c501: 30,
    scanNoir: 1,
    scanCouleur: 2,
    envoi: 0,
    observationMotif: null,
    observations: null,
  };

  it('pre-remplit une ligne depuis un releve existant', () => {
    const data = buildLigneDataFromReleve('imp-1', releve);
    expect(data.c112).toBe(100);
    expect(data.c501).toBe(30);
    expect(data.archiveVersReleveId).toBe('rel-1');
    expect(data.statutLigne).toBe(StatutLigneSaisie.PRET);
  });

  it('mappe anomalie releve vers anomalie ligne', () => {
    expect(statutLigneForLinkedReleve(StatutReleve.ANOMALIE_COMPTEUR)).toBe(
      StatutLigneSaisie.ANOMALIE,
    );
  });
});
