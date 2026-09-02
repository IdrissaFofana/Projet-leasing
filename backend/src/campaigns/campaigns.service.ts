import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import * as fs from 'fs';
import {
  PorteeCampagne,
  Prisma,
  StatutImprimante,
  StatutLigneSaisie,
  StatutReleve,
} from '@prisma/client';
import { buildEsayWorkbook } from '../common/export/excel-builder';
import { buildEsayPdf } from '../common/export/pdf-builder';
import {
  buildLigneDataFromReleve,
  buildLigneUpdateFromReleve,
  maybeCloseCampagne,
  transferLigneRapportToReleve,
} from '../common/domain/campaign-releve-sync';
import {
  absoluteUploadPath,
  saveReportFile,
} from '../common/upload/report-files';
import { PrismaService } from '../prisma/prisma.service';
import { ReadingsService } from '../readings/readings.service';
import { CreateCampaignDto, AddCampaignLignesDto, UpdateCampaignLigneDto } from './dto/campaign.dto';

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

    const releveIds = campagne.lignes
      .map((l) => l.archiveVersReleveId)
      .filter((id): id is string => !!id);
    const releves =
      releveIds.length === 0
        ? []
        : await this.prisma.releveCompteur.findMany({
            where: { id: { in: releveIds } },
            select: { id: true, rapportNom: true, rapportPath: true },
          });
    const releveRapport = new Map(releves.map((r) => [r.id, r]));

    const dateReleve =
      campagne.dateReleve instanceof Date
        ? campagne.dateReleve.toISOString().slice(0, 10)
        : String(campagne.dateReleve).slice(0, 10);
    const previousByPrinter = await this.readings.findPreviousBatch(
      campagne.lignes.map((l) => l.imprimanteId),
      mois,
      dateReleve,
    );

    return {
      ...campagne,
      lignes: campagne.lignes.map((l) => {
        const linked = l.archiveVersReleveId
          ? releveRapport.get(l.archiveVersReleveId)
          : null;
        return {
          ...l,
          releveRapportNom: linked?.rapportNom ?? null,
          releveRapportPath: linked?.rapportPath ?? null,
          previous: previousByPrinter.get(l.imprimanteId) ?? null,
        };
      }),
    };
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
      { label: 'Portée', value: campagne.portee === PorteeCampagne.ALL ? 'Tous les copieurs' : 'Sélection' },
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
        { key: 'c501', header: '501', width: 38, align: 'right' },
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

    const portee = dto.portee ?? PorteeCampagne.ALL;

    if (portee === PorteeCampagne.SELECTION) {
      if (!dto.imprimanteIds?.length) {
        throw new BadRequestException('Sélectionnez au moins un copieur pour une campagne partielle');
      }
    }

    const printers = await this.resolvePrinters(portee, dto.imprimanteIds);
    if (printers.length === 0) {
      throw new BadRequestException('Aucun copieur éligible pour cette campagne');
    }

    return this.prisma.$transaction(async (tx) => {
      const campagne = await tx.campagneSaisie.create({
        data: {
          mois: dto.mois,
          dateReleve: new Date(dto.dateReleve),
          heureReleve: dto.heureReleve ?? '09:00',
          portee,
          lignes: {
            create: await Promise.all(
              printers.map((p) => this.buildLigneCreateData(tx, p.id, dto.mois)),
            ),
          },
        },
        include: campagneInclude,
      });
      await maybeCloseCampagne(tx, campagne.id);
      return tx.campagneSaisie.findUniqueOrThrow({
        where: { id: campagne.id },
        include: campagneInclude,
      });
    });
  }

  private async resolvePrinters(portee: PorteeCampagne, imprimanteIds?: string[]) {
    if (portee === PorteeCampagne.ALL) {
      return this.prisma.imprimante.findMany({
        where: { statut: { not: StatutImprimante.RETIREE } },
        orderBy: { code: 'asc' },
      });
    }

    const uniqueIds = [...new Set(imprimanteIds ?? [])];
    const printers = await this.prisma.imprimante.findMany({
      where: {
        id: { in: uniqueIds },
        statut: { not: StatutImprimante.RETIREE },
      },
      orderBy: { code: 'asc' },
    });

    if (printers.length !== uniqueIds.length) {
      const found = new Set(printers.map((p) => p.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Copieur(s) introuvable(s) ou retiré(s) : ${missing.join(', ')}`,
      );
    }

    return printers;
  }

  private async buildLigneCreateData(
    tx: Prisma.TransactionClient,
    imprimanteId: string,
    mois: string,
  ): Promise<Prisma.LigneSaisieMensuelleUncheckedCreateWithoutCampagneInput> {
    const deja = await tx.releveCompteur.findUnique({
      where: {
        imprimanteId_moisFacture: {
          imprimanteId,
          moisFacture: mois,
        },
      },
    });
    if (deja) {
      return buildLigneDataFromReleve(imprimanteId, deja);
    }
    return {
      imprimanteId,
      statutLigne: StatutLigneSaisie.A_SAISIR,
    };
  }

  async addLignes(mois: string, dto: AddCampaignLignesDto) {
    const campagne = await this.findByMois(mois);
    if (campagne.cloturee) {
      throw new BadRequestException(`Campagne ${mois} cloturee`);
    }

    const uniqueIds = [...new Set(dto.imprimanteIds)];
    const existingIds = new Set(campagne.lignes.map((l) => l.imprimanteId));
    const alreadyIn = uniqueIds.filter((id) => existingIds.has(id));
    if (alreadyIn.length > 0) {
      throw new ConflictException(
        `${alreadyIn.length} copieur(s) deja present(s) dans la campagne`,
      );
    }

    const printers = await this.resolvePrinters(PorteeCampagne.SELECTION, uniqueIds);

    await this.prisma.$transaction(async (tx) => {
      for (const p of printers) {
        await tx.ligneSaisieMensuelle.create({
          data: {
            campagneId: campagne.id,
            ...(await this.buildLigneCreateData(tx, p.id, mois)),
          },
        });
      }

      if (campagne.portee === PorteeCampagne.ALL) {
        await tx.campagneSaisie.update({
          where: { id: campagne.id },
          data: { portee: PorteeCampagne.SELECTION },
        });
      }
      await maybeCloseCampagne(tx, campagne.id);
    });

    return this.findByMois(mois);
  }

  async removeLigne(mois: string, printerId: string) {
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
      throw new BadRequestException('Ligne deja liee a un releve — retrait impossible');
    }

    if (ligne.rapportPath) {
      const abs = absoluteUploadPath(ligne.rapportPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }

    await this.prisma.ligneSaisieMensuelle.delete({ where: { id: ligne.id } });
    return this.findByMois(mois);
  }

  private async findLigne(mois: string, printerId: string) {
    const campagne = await this.prisma.campagneSaisie.findUnique({ where: { mois } });
    if (!campagne) throw new NotFoundException('Campagne introuvable');
    const ligne = await this.prisma.ligneSaisieMensuelle.findUnique({
      where: {
        campagneId_imprimanteId: {
          campagneId: campagne.id,
          imprimanteId: printerId,
        },
      },
    });
    if (!ligne) throw new NotFoundException('Ligne campagne introuvable');
    return { campagne, ligne };
  }

  async uploadRapportLigne(mois: string, printerId: string, file: Express.Multer.File) {
    const { campagne, ligne } = await this.findLigne(mois, printerId);
    if (campagne.cloturee) {
      throw new BadRequestException(`Campagne ${mois} cloturee`);
    }

    if (ligne.archiveVersReleveId) {
      await this.readings.uploadRapport(ligne.archiveVersReleveId, file);
      return this.findByMois(mois);
    }

    if (ligne.rapportPath) {
      const prev = absoluteUploadPath(ligne.rapportPath);
      if (fs.existsSync(prev)) fs.unlinkSync(prev);
    }

    const saved = saveReportFile('campagnes', file);
    await this.prisma.ligneSaisieMensuelle.update({
      where: { id: ligne.id },
      data: {
        rapportPath: saved.relativePath,
        rapportNom: saved.originalName,
        rapportMime: saved.mime,
      },
    });
    return this.findByMois(mois);
  }

  async downloadRapportLigne(mois: string, printerId: string) {
    const { ligne } = await this.findLigne(mois, printerId);

    if (ligne.archiveVersReleveId) {
      return this.readings.downloadRapport(ligne.archiveVersReleveId);
    }

    if (!ligne.rapportPath) throw new NotFoundException('Aucun rapport attaché');
    const abs = absoluteUploadPath(ligne.rapportPath);
    if (!fs.existsSync(abs)) throw new NotFoundException('Fichier rapport introuvable');
    const buf = fs.readFileSync(abs);
    return new StreamableFile(buf, {
      type: ligne.rapportMime ?? 'application/octet-stream',
      disposition: `inline; filename="${ligne.rapportNom ?? 'rapport'}"`,
    });
  }

  async remove(mois: string) {
    const campagne = await this.findByMois(mois);
    if (campagne.cloturee) {
      throw new BadRequestException(`Campagne ${mois} cloturee — suppression impossible`);
    }
    const archived = campagne.lignes.some((l) => l.archiveVersReleveId);
    if (archived) {
      throw new BadRequestException(
        'Des releves ont ete archives depuis cette campagne — suppression impossible',
      );
    }

    await this.prisma.campagneSaisie.delete({ where: { mois } });
    return { ok: true, mois };
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
      throw new BadRequestException('Ligne deja liee a un releve');
    }

    const merged = {
      c112: dto.c112 !== undefined ? dto.c112 : ligne.c112,
      c113: dto.c113 !== undefined ? dto.c113 : ligne.c113,
      c122: dto.c122 !== undefined ? dto.c122 : ligne.c122,
      c123: dto.c123 !== undefined ? dto.c123 : ligne.c123,
      c501: dto.c501 !== undefined ? dto.c501 : ligne.c501,
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

  private isLigneArchivable(ligne: {
    archiveVersReleveId: string | null;
    c112: number | null;
    c113: number | null;
    c122: number | null;
    c123: number | null;
    statutLigne: StatutLigneSaisie;
  }) {
    if (ligne.archiveVersReleveId) return false;
    const filled = [ligne.c112, ligne.c113, ligne.c122, ligne.c123].filter(
      (v) => v !== null && v !== undefined,
    ).length;
    return (
      filled === 4 &&
      (ligne.statutLigne === StatutLigneSaisie.PRET ||
        ligne.statutLigne === StatutLigneSaisie.ANOMALIE)
    );
  }

  async reopen(mois: string) {
    const campagne = await this.prisma.campagneSaisie.findUnique({ where: { mois } });
    if (!campagne) throw new NotFoundException('Campagne introuvable');
    if (!campagne.cloturee) {
      return this.findByMois(mois);
    }
    const unlinked = await this.prisma.ligneSaisieMensuelle.count({
      where: { campagneId: campagne.id, archiveVersReleveId: null },
    });
    if (unlinked === 0) {
      throw new BadRequestException('Campagne deja cloturee — toutes les lignes sont liees');
    }
    await this.prisma.campagneSaisie.update({
      where: { mois },
      data: { cloturee: false },
    });
    return this.findByMois(mois);
  }

  async archive(mois: string) {
    const campagne = await this.findByMois(mois);

    if (campagne.cloturee) {
      const unlinked = campagne.lignes.filter((l) => !l.archiveVersReleveId);
      if (unlinked.length === 0) {
        throw new BadRequestException(`Campagne ${mois} deja cloturee`);
      }
      await this.prisma.campagneSaisie.update({
        where: { mois },
        data: { cloturee: false },
      });
    }

    const pret = campagne.lignes.filter((l) => this.isLigneArchivable(l));
    if (pret.length === 0) {
      throw new BadRequestException(
        'Aucune ligne archivable (statut PRET ou ANOMALIE avec compteurs 112–123 complets)',
      );
    }

    const results: Array<{
      imprimanteId: string;
      code?: string;
      statut?: StatutReleve;
      error?: string;
    }> = [];

    for (const ligne of pret) {
      try {
        const existing = await this.prisma.releveCompteur.findUnique({
          where: {
            imprimanteId_moisFacture: {
              imprimanteId: ligne.imprimanteId,
              moisFacture: mois,
            },
          },
        });

        if (existing) {
          await this.prisma.$transaction(async (tx) => {
            await tx.ligneSaisieMensuelle.update({
              where: { id: ligne.id },
              data: buildLigneUpdateFromReleve(existing),
            });
            await transferLigneRapportToReleve(tx, ligne, existing.id);
          });
          results.push({
            imprimanteId: ligne.imprimanteId,
            code: existing.code,
            statut: existing.statut,
          });
          continue;
        }

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
          scanNoir: ligne.scanNoir ?? 0,
          scanCouleur: ligne.scanCouleur ?? 0,
          envoi: ligne.envoi ?? 0,
          observationMotif: ligne.observationMotif ?? undefined,
          observations: ligne.observations ?? undefined,
        });

        await this.prisma.$transaction(async (tx) => {
          await tx.ligneSaisieMensuelle.update({
            where: { id: ligne.id },
            data: {
              archiveVersReleveId: releve.id,
              statutLigne:
                releve.statut === StatutReleve.ANOMALIE_COMPTEUR
                  ? StatutLigneSaisie.ANOMALIE
                  : StatutLigneSaisie.PRET,
            },
          });
          await transferLigneRapportToReleve(tx, ligne, releve.id);
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

    const unlinked = await this.prisma.ligneSaisieMensuelle.count({
      where: {
        campagneId: campagne.id,
        archiveVersReleveId: null,
      },
    });

    const campagneCloturee = unlinked === 0;
    if (campagneCloturee) {
      await this.prisma.campagneSaisie.update({
        where: { id: campagne.id },
        data: { cloturee: true },
      });
    }

    return {
      mois,
      archives: results,
      campagneCloturee,
      restantes: unlinked,
    };
  }
}
