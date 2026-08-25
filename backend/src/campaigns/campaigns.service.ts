import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutImprimante,
  StatutLigneSaisie,
  StatutReleve,
} from '@prisma/client';
import { buildEsayWorkbook } from '../common/export/excel-builder';
import { buildEsayPdf } from '../common/export/pdf-builder';
import { PrismaService } from '../prisma/prisma.service';
import { ReadingsService } from '../readings/readings.service';
import { CreateCampaignDto, UpdateCampaignLigneDto } from './dto/campaign.dto';

const campagneInclude = {
  lignes: {
    include: { imprimante: { include: { marque: true, service: true } } },
    orderBy: [
      { imprimante: { localisation: 'asc' as const } },
      { imprimante: { code: 'asc' as const } },
    ],
  },
} satisfies Prisma.CampagneSaisieInclude;

const STATUT_LABEL: Record<string, string> = {
  A_SAISIR: 'À saisir',
  BROUILLON: 'Brouillon',
  PRET: 'Prêt',
  ANOMALIE: 'Anomalie',
  DOUBLON_POSSIBLE: 'Doublon possible',
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readings: ReadingsService,
  ) {}

  findAll() {
    return this.prisma.campagneSaisie.findMany({
      include: {
        _count: { select: { lignes: true } },
      },
      orderBy: { mois: 'desc' },
    });
  }

  async findByMois(mois: string) {
    const campagne = await this.prisma.campagneSaisie.findUnique({
      where: { mois },
      include: campagneInclude,
    });
    if (!campagne) throw new NotFoundException('Campagne introuvable');
    return campagne;
  }

  async export(mois: string, format: 'xlsx' | 'pdf') {
    const campagne = await this.findByMois(mois);
    const lignes = campagne.lignes;
    const resume = {
      total: lignes.length,
      aSaisir: lignes.filter((l) => l.statutLigne === StatutLigneSaisie.A_SAISIR).length,
      brouillon: lignes.filter((l) => l.statutLigne === StatutLigneSaisie.BROUILLON).length,
      pret: lignes.filter(
        (l) => l.statutLigne === StatutLigneSaisie.PRET && !l.archiveVersReleveId,
      ).length,
      archivees: lignes.filter((l) => !!l.archiveVersReleveId).length,
    };

    const mapped = lignes.map((l) => ({
      imprimante: l.imprimante.code,
      localisation: l.imprimante.localisation ?? '',
      modele: l.imprimante.modele ?? '',
      c112: l.c112,
      c113: l.c113,
      c122: l.c122,
      c123: l.c123,
      c301: l.c301,
      c501: l.c501,
      scanN: l.scanNoir,
      scanC: l.scanCouleur,
      envoi: l.envoi,
      motif: l.observationMotif ?? '',
      observations: l.observations ?? '',
      statut: STATUT_LABEL[l.statutLigne] ?? l.statutLigne,
      archive: l.archiveVersReleveId ? 'Oui' : 'Non',
    }));

    const columns = [
      { key: 'imprimante', header: 'Imprimante', width: 12 },
      { key: 'localisation', header: 'Localisation', width: 22 },
      { key: 'modele', header: 'Modèle', width: 16 },
      { key: 'c112', header: '112', width: 9, align: 'right' as const },
      { key: 'c113', header: '113', width: 9, align: 'right' as const },
      { key: 'c122', header: '122', width: 9, align: 'right' as const },
      { key: 'c123', header: '123', width: 9, align: 'right' as const },
      { key: 'c301', header: '301', width: 9, align: 'right' as const },
      { key: 'c501', header: '501', width: 9, align: 'right' as const },
      { key: 'scanN', header: 'Scan N', width: 9, align: 'right' as const },
      { key: 'scanC', header: 'Scan C', width: 9, align: 'right' as const },
      { key: 'envoi', header: 'Envoi', width: 9, align: 'right' as const },
      { key: 'motif', header: 'Motif', width: 14 },
      { key: 'statut', header: 'Statut', width: 14 },
      { key: 'archive', header: 'Archivé', width: 10, align: 'center' as const },
      { key: 'observations', header: 'Observations', width: 24 },
    ];

    const dateReleve =
      campagne.dateReleve instanceof Date
        ? campagne.dateReleve.toISOString().slice(0, 10)
        : String(campagne.dateReleve).slice(0, 10);

    const title = `Campagne saisie — ${mois}`;
    const subtitle = `${campagne.cloturee ? 'Clôturée' : 'Ouverte'} · Relève ${dateReleve}${
      campagne.heureReleve ? ` ${campagne.heureReleve}` : ''
    }`;
    const meta = [
      { label: 'Lignes', value: String(resume.total) },
      { label: 'À saisir', value: String(resume.aSaisir) },
      { label: 'Brouillon', value: String(resume.brouillon) },
      { label: 'Prêt', value: String(resume.pret) },
      { label: 'Archivées', value: String(resume.archivees) },
    ];

    const baseName = `campagne-${mois}`;

    if (format === 'xlsx') {
      const buffer = await buildEsayWorkbook([
        {
          title,
          subtitle,
          meta,
          columns,
          rows: mapped,
          footerNote:
            'Campagne de saisie mensuelle — les lignes archivées correspondent à des relevés officiels',
        },
      ]);
      return {
        filename: `${baseName}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    const buffer = await buildEsayPdf({
      title,
      subtitle,
      meta,
      landscape: true,
      columns: [
        { key: 'imprimante', header: 'Imp.', width: 52 },
        { key: 'localisation', header: 'Localisation', width: 95 },
        { key: 'c112', header: '112', width: 38, align: 'right' },
        { key: 'c113', header: '113', width: 38, align: 'right' },
        { key: 'c122', header: '122', width: 38, align: 'right' },
        { key: 'c123', header: '123', width: 38, align: 'right' },
        { key: 'c301', header: '301', width: 38, align: 'right' },
        { key: 'statut', header: 'Statut', width: 70 },
        { key: 'archive', header: 'Arch.', width: 36, align: 'center' },
      ],
      rows: mapped,
      footerNote: 'Export campagne ESAY — saisie mensuelle avant archivage vers relevés',
    });
    return {
      filename: `${baseName}.pdf`,
      mime: 'application/pdf',
      buffer,
    };
  }

  async create(dto: CreateCampaignDto) {
    const existing = await this.prisma.campagneSaisie.findUnique({
      where: { mois: dto.mois },
    });
    if (existing) throw new ConflictException(`Campagne ${dto.mois} deja ouverte`);

    const printers = await this.prisma.imprimante.findMany({
      where: { statut: { not: StatutImprimante.RETIREE } },
      orderBy: { code: 'asc' },
    });

    return this.prisma.$transaction(async (tx) => {
      const campagne = await tx.campagneSaisie.create({
        data: {
          mois: dto.mois,
          dateReleve: new Date(dto.dateReleve),
          heureReleve: dto.heureReleve ?? '09:00',
          lignes: {
            create: await Promise.all(
              printers.map(async (p) => {
                const deja = await tx.releveCompteur.findUnique({
                  where: {
                    imprimanteId_moisFacture: {
                      imprimanteId: p.id,
                      moisFacture: dto.mois,
                    },
                  },
                });
                return {
                  imprimanteId: p.id,
                  statutLigne: deja
                    ? StatutLigneSaisie.DOUBLON_POSSIBLE
                    : StatutLigneSaisie.A_SAISIR,
                  observations: deja
                    ? `Releve existant ${deja.code}`
                    : undefined,
                };
              }),
            ),
          },
        },
        include: campagneInclude,
      });
      return campagne;
    });
  }

  async updateLigne(mois: string, printerId: string, dto: UpdateCampaignLigneDto) {
    const campagne = await this.findByMois(mois);
    if (campagne.cloturee) {
      throw new BadRequestException(`Campagne ${mois} cloturee`);
    }

    const ligne = await this.prisma.ligneSaisieMensuelle.findUnique({
      where: {
        campagneId_imprimanteId: {
          campagneId: campagne.id,
          imprimanteId: printerId,
        },
      },
    });
    if (!ligne) throw new NotFoundException('Ligne campagne introuvable');
    if (ligne.archiveVersReleveId) {
      throw new BadRequestException('Ligne deja archivee');
    }
    if (ligne.statutLigne === StatutLigneSaisie.DOUBLON_POSSIBLE) {
      throw new BadRequestException('Ligne en doublon — relevé déjà présent pour le mois');
    }

    const merged = {
      c112: dto.c112 !== undefined ? dto.c112 : ligne.c112,
      c113: dto.c113 !== undefined ? dto.c113 : ligne.c113,
      c122: dto.c122 !== undefined ? dto.c122 : ligne.c122,
      c123: dto.c123 !== undefined ? dto.c123 : ligne.c123,
      c501: dto.c501 !== undefined ? dto.c501 : ligne.c501,
      c301: dto.c301 !== undefined ? dto.c301 : ligne.c301,
      scanNoir: dto.scanNoir !== undefined ? dto.scanNoir : ligne.scanNoir,
      scanCouleur: dto.scanCouleur !== undefined ? dto.scanCouleur : ligne.scanCouleur,
      envoi: dto.envoi !== undefined ? dto.envoi : ligne.envoi,
      observationMotif:
        dto.observationMotif !== undefined ? dto.observationMotif : ligne.observationMotif,
      observations:
        dto.observations !== undefined ? dto.observations : ligne.observations,
    };

    const filled = [merged.c112, merged.c113, merged.c122, merged.c123].filter(
      (v) => v !== null && v !== undefined,
    ).length;
    const complete = filled === 4;
    const partial = filled > 0 && !complete;

    let statutLigne: StatutLigneSaisie = StatutLigneSaisie.A_SAISIR;
    if (complete) statutLigne = StatutLigneSaisie.PRET;
    else if (partial) statutLigne = StatutLigneSaisie.BROUILLON;

    return this.prisma.ligneSaisieMensuelle.update({
      where: { id: ligne.id },
      data: {
        ...merged,
        statutLigne,
      },
      include: { imprimante: { include: { marque: true, service: true } } },
    });
  }

  async archive(mois: string) {
    const campagne = await this.findByMois(mois);
    if (campagne.cloturee) {
      throw new BadRequestException(`Campagne ${mois} deja cloturee`);
    }

    const pret = campagne.lignes.filter(
      (l) => l.statutLigne === StatutLigneSaisie.PRET && !l.archiveVersReleveId,
    );
    if (pret.length === 0) {
      throw new BadRequestException('Aucune ligne PRET a archiver');
    }

    const results: Array<{
      imprimanteId: string;
      code?: string;
      statut?: StatutReleve;
      error?: string;
    }> = [];

    for (const ligne of pret) {
      try {
        const releve = await this.readings.create({
          imprimanteId: ligne.imprimanteId,
          moisFacture: mois,
          dateReleve: campagne.dateReleve.toISOString().slice(0, 10),
          heureReleve: campagne.heureReleve ?? undefined,
          c112: ligne.c112 ?? 0,
          c113: ligne.c113 ?? 0,
          c122: ligne.c122 ?? 0,
          c123: ligne.c123 ?? 0,
          c501: ligne.c501 ?? undefined,
          c301: ligne.c301 ?? undefined,
          scanNoir: ligne.scanNoir ?? 0,
          scanCouleur: ligne.scanCouleur ?? 0,
          envoi: ligne.envoi ?? 0,
          observationMotif: ligne.observationMotif ?? undefined,
          observations: ligne.observations ?? undefined,
        });

        await this.prisma.ligneSaisieMensuelle.update({
          where: { id: ligne.id },
          data: {
            archiveVersReleveId: releve.id,
            statutLigne:
              releve.statut === StatutReleve.ANOMALIE_COMPTEUR
                ? StatutLigneSaisie.ANOMALIE
                : StatutLigneSaisie.PRET,
          },
        });

        results.push({
          imprimanteId: ligne.imprimanteId,
          code: releve.code,
          statut: releve.statut,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erreur archive';
        await this.prisma.ligneSaisieMensuelle.update({
          where: { id: ligne.id },
          data: {
            statutLigne: StatutLigneSaisie.ANOMALIE,
            observations: message,
          },
        });
        results.push({ imprimanteId: ligne.imprimanteId, error: message });
      }
    }

    const remaining = await this.prisma.ligneSaisieMensuelle.count({
      where: {
        campagneId: campagne.id,
        archiveVersReleveId: null,
        statutLigne: { in: [StatutLigneSaisie.A_SAISIR, StatutLigneSaisie.PRET] },
      },
    });

    if (remaining === 0) {
      await this.prisma.campagneSaisie.update({
        where: { id: campagne.id },
        data: { cloturee: true },
      });
    }

    return {
      mois,
      archives: results,
      campagneCloturee: remaining === 0,
      restantes: remaining,
    };
  }
}
