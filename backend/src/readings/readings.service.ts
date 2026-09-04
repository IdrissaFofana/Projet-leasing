import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  EntiteSequence,
  ObservationReleve,
  Prisma,
  ReleveCompteur,
  StatutFacturePeriode,
  StatutImprimante,
  StatutLigneSaisie,
  StatutReleve,
  TypeMaintenance,
} from '@prisma/client';
import * as fs from 'fs';
import {
  computeReleve,
  explainAnomalyFromStored,
  explainAnomalyReasons,
  poseToPreviousSnapshot,
  printerHasPoseCounters,
  type PreviousSnapshot,
} from '../common/domain/calculs';
import { syncCampagneLigneFromReleve } from '../common/domain/campaign-releve-sync';
import {
  absoluteUploadPath,
  saveReportFile,
} from '../common/upload/report-files';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../sequences/sequences.service';
import {
  AcceptAnomalyDto,
  CreateReadingDto,
  ImportReadingsDto,
  MonthlyViewQueryDto,
  PreviousReadingQueryDto,
  ReadingQueryDto,
  UpdateReadingDto,
} from './dto/reading.dto';

type CounterSnapshot = {
  c112: number;
  c113: number;
  c122: number;
  c123: number;
  c501: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
};

const readingInclude = {
  imprimante: { include: { marque: true, service: true } },
  assistance: true,
} satisfies Prisma.ReleveCompteurInclude;

const LOCKED: StatutReleve[] = [StatutReleve.VALIDE];

@Injectable()
export class ReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
  ) {}

  async findAll(query: ReadingQueryDto) {
    const where: Prisma.ReleveCompteurWhereInput = {};
    if (query.mois) where.moisFacture = query.mois;
    if (query.imprimanteId) where.imprimanteId = query.imprimanteId;
    if (query.statut) where.statut = query.statut;

    if (query.file === 'anomalie') {
      where.statut = StatutReleve.ANOMALIE_COMPTEUR;
    } else if (query.file === 'controle') {
      where.OR = [
        { statut: StatutReleve.A_CONTROLER },
        { alerteDeltaHaut: true },
        { statut: StatutReleve.ANOMALIE_COMPTEUR },
      ];
    } else if (query.file === 'ok') {
      where.statut = { in: [StatutReleve.OK, StatutReleve.CONTROLE, StatutReleve.VALIDE] };
    }

    if (query.q || query.serviceId || query.marqueId || query.localisation) {
      where.imprimante = {
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.marqueId ? { marqueId: query.marqueId } : {}),
        ...(query.localisation
          ? { localisation: { contains: query.localisation, mode: 'insensitive' } }
          : {}),
        ...(query.q
          ? {
              OR: [
                { code: { contains: query.q, mode: 'insensitive' } },
                { modele: { contains: query.q, mode: 'insensitive' } },
                { numeroSerie: { contains: query.q, mode: 'insensitive' } },
                { localisation: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
    }

    const rows = await this.prisma.releveCompteur.findMany({
      where,
      include: readingInclude,
      orderBy: [
        { imprimante: { localisation: 'asc' } },
        { imprimante: { code: 'asc' } },
        { moisFacture: 'desc' },
      ],
    });

    return rows.map((row) => ({
      ...row,
      anomalyReasons:
        row.statut === StatutReleve.ANOMALIE_COMPTEUR
          ? explainAnomalyFromStored(row)
          : [],
    }));
  }

  async findOne(id: string) {
    const row = await this.prisma.releveCompteur.findUnique({
      where: { id },
      include: {
        ...readingInclude,
        audits: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!row) throw new NotFoundException('Releve introuvable');

    let anomalyReasons: string[] = [];
    if (row.statut === StatutReleve.ANOMALIE_COMPTEUR) {
      const prev = await this.findPrevious(
        row.imprimanteId,
        row.moisFacture,
        row.dateReleve.toISOString().slice(0, 10),
        row.id,
      );
      if (prev) {
        const snap: PreviousSnapshot =
          'fromPose' in prev && prev.fromPose
            ? prev
            : {
                totalNoir: prev.totalNoir,
                totalCouleur: prev.totalCouleur,
                c112: prev.c112,
                c113: prev.c113,
                c122: prev.c122,
                c123: prev.c123,
                c501: prev.c501,
                scanNoir: prev.scanNoir,
                scanCouleur: prev.scanCouleur,
                envoi: prev.envoi,
              };
        anomalyReasons = explainAnomalyReasons(
          {
            c112: row.c112,
            c113: row.c113,
            c122: row.c122,
            c123: row.c123,
            c501: row.c501,
            scanNoir: row.scanNoir,
            scanCouleur: row.scanCouleur,
            envoi: row.envoi,
          },
          snap,
        );
      } else {
        anomalyReasons = explainAnomalyFromStored(row);
      }
    }

    return { ...row, anomalyReasons };
  }

  async previous(query: PreviousReadingQueryDto) {
    await this.ensurePrinter(query.imprimanteId);
    const date = query.dateReleve ?? `${query.moisFacture}-28`;
    const prev = await this.findPrevious(query.imprimanteId, query.moisFacture, date);
    if (!prev) return null;

    // Compteurs initiaux : on fabrique un "PreviousReading" pour alimenter l'UI.
    if ('fromPose' in prev && prev.fromPose) {
      return {
        id: `pose-${query.imprimanteId}`,
        code: 'BASE_POSE',
        moisFacture: query.moisFacture,
        dateReleve: date,
        c112: prev.c112,
        c113: prev.c113,
        c122: prev.c122,
        c123: prev.c123,
        c501: prev.c501 ?? null,
        scanNoir: prev.scanNoir,
        scanCouleur: prev.scanCouleur,
        envoi: prev.envoi,
        totalNoir: prev.totalNoir,
        totalCouleur: prev.totalCouleur,
        copiesNoirFacturer: 0,
        copiesCouleurFacturer: 0,
        quotaNoirReport: prev.quotaNoirReport ?? 0,
        quotaCouleurReport: prev.quotaCouleurReport ?? 0,
      };
    }

    return this.formatPreviousSnapshot(prev as ReleveCompteur);
  }

  /** Dernier relevé officiel par copieur (batch, pour campagnes). */
  async findPreviousBatch(
    imprimanteIds: string[],
    moisFacture: string,
    dateReleve: string,
  ) {
    const unique = [...new Set(imprimanteIds)];
    if (unique.length === 0) return new Map<string, ReturnType<typeof this.formatPreviousSnapshot>>();

    const rows = await this.prisma.releveCompteur.findMany({
      where: {
        imprimanteId: { in: unique },
        statut: { not: StatutReleve.BROUILLON },
        OR: [
          { moisFacture: { lt: moisFacture } },
          {
            moisFacture,
            dateReleve: { lt: new Date(dateReleve) },
          },
        ],
      },
      orderBy: [{ moisFacture: 'desc' }, { dateReleve: 'desc' }, { createdAt: 'desc' }],
    });

    const map = new Map<string, ReturnType<typeof this.formatPreviousSnapshot>>();
    for (const row of rows) {
      if (!map.has(row.imprimanteId)) {
        map.set(row.imprimanteId, this.formatPreviousSnapshot(row));
      }
    }
    return map;
  }

  private formatPreviousSnapshot(prev: ReleveCompteur) {
    return {
      id: prev.id,
      code: prev.code,
      moisFacture: prev.moisFacture,
      dateReleve: prev.dateReleve,
      c112: prev.c112,
      c113: prev.c113,
      c122: prev.c122,
      c123: prev.c123,
      c501: prev.c501,
      scanNoir: prev.scanNoir,
      scanCouleur: prev.scanCouleur,
      envoi: prev.envoi,
      totalNoir: prev.totalNoir,
      totalCouleur: prev.totalCouleur,
      copiesNoirFacturer: prev.copiesNoirFacturer,
      copiesCouleurFacturer: prev.copiesCouleurFacturer,
      copiesNoirDelta: prev.copiesNoirDelta,
      copiesCouleurDelta: prev.copiesCouleurDelta,
      quotaNoirReport: prev.quotaNoirReport,
      quotaCouleurReport: prev.quotaCouleurReport,
    };
  }

  async create(dto: CreateReadingDto, userId?: string) {
    await this.ensurePrinter(dto.imprimanteId);
    await this.ensurePeriodeOuverte(dto.moisFacture);

    const dup = await this.prisma.releveCompteur.findUnique({
      where: {
        imprimanteId_moisFacture: {
          imprimanteId: dto.imprimanteId,
          moisFacture: dto.moisFacture,
        },
      },
    });
    if (dup) {
      throw new ConflictException(
        `Releve deja existant pour cette imprimante et le mois ${dto.moisFacture}`,
      );
    }

    const counters = this.normalizeCounters(dto);
    const previous = await this.findPrevious(dto.imprimanteId, dto.moisFacture, dto.dateReleve);
    const avgs = await this.avgDeltas(dto.imprimanteId, dto.moisFacture);
    const computed = this.compute(counters, previous, dto.observationMotif, avgs);
    const statut = dto.brouillon
      ? StatutReleve.BROUILLON
      : previous
        ? computed.statut
        : StatutReleve.BASE_INITIALE;

    return this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode(EntiteSequence.RELEVE, tx);
      const row = await tx.releveCompteur.create({
        data: {
          code,
          imprimanteId: dto.imprimanteId,
          moisFacture: dto.moisFacture,
          dateReleve: new Date(dto.dateReleve),
          heureReleve: this.parseHeure(dto.heureReleve),
          ...counters,
          ...computed,
          statut,
          observationMotif: dto.observationMotif,
          observations: dto.observations,
        },
        include: readingInclude,
      });
      await tx.releveAudit.create({
        data: {
          releveId: row.id,
          userId: userId ?? null,
          action: 'CREATE',
          afterJson: JSON.stringify(this.auditSnapshot(row)),
        },
      });

      // Prélèvement compteur : assistance auto liée au relevé (hors quota mensuel)
      const mntCode = await this.sequences.nextCode(EntiteSequence.MAINTENANCE, tx);
      await tx.maintenance.create({
        data: {
          code: mntCode,
          dateMaintenance: new Date(dto.dateReleve),
          heureMaintenance: this.parseHeure(dto.heureReleve),
          imprimanteId: dto.imprimanteId,
          type: TypeMaintenance.ASSISTANCE,
          taches: [TypeMaintenance.ASSISTANCE],
          moisAssistance: dto.moisFacture,
          releveId: row.id,
          horsQuota: false,
          actionsRealisees: `Prélèvement compteurs — relevé ${code}`,
          observations: 'Assistance générée automatiquement depuis le relevé mensuel',
          imprimantes: {
            create: { imprimanteId: dto.imprimanteId },
          },
        },
      });

      await syncCampagneLigneFromReleve(tx, row);

      return tx.releveCompteur.findUniqueOrThrow({
        where: { id: row.id },
        include: readingInclude,
      });
    });
  }

  async uploadRapport(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);
    if (existing.rapportPath) {
      const prev = absoluteUploadPath(existing.rapportPath);
      if (fs.existsSync(prev)) fs.unlinkSync(prev);
    }
    const saved = saveReportFile('releves', file);
    return this.prisma.releveCompteur.update({
      where: { id },
      data: {
        rapportPath: saved.relativePath,
        rapportNom: saved.originalName,
        rapportMime: saved.mime,
      },
      include: readingInclude,
    });
  }

  async downloadRapport(id: string) {
    const row = await this.findOne(id);
    if (!row.rapportPath) throw new NotFoundException('Aucun rapport attaché');
    const abs = absoluteUploadPath(row.rapportPath);
    if (!fs.existsSync(abs)) throw new NotFoundException('Fichier rapport introuvable');
    const buf = fs.readFileSync(abs);
    return new StreamableFile(buf, {
      type: row.rapportMime ?? 'application/octet-stream',
      disposition: `inline; filename="${row.rapportNom ?? 'rapport'}"`,
    });
  }

  /**
   * Suppression pour correction campagne : déverrouille un relevé VALIDE
   * puis délègue à remove() (relie la ligne campagne en PRET, rouvre la campagne).
   */
  async removeForCorrection(id: string, userId?: string) {
    const existing = await this.findOne(id);
    await this.ensureFactureNonCloturee(existing.moisFacture);

    if (existing.statut === StatutReleve.VALIDE) {
      await this.prisma.releveCompteur.update({
        where: { id },
        data: {
          statut: StatutReleve.OK,
          valideAt: null,
          valideParId: null,
        },
      });
      await this.prisma.releveAudit.create({
        data: {
          releveId: id,
          userId: userId ?? null,
          action: 'UNLOCK_FOR_CORRECTION',
          beforeJson: JSON.stringify({ statut: StatutReleve.VALIDE }),
          afterJson: JSON.stringify({ statut: StatutReleve.OK }),
        },
      });
    }

    return this.remove(id, userId);
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);
    this.ensureDeletable(existing);
    await this.ensureFactureNonCloturee(existing.moisFacture);

    const facture = await this.prisma.facturePeriode.findUnique({
      where: { mois: existing.moisFacture },
    });
    const factureCalculee =
      facture != null && facture.statut !== StatutFacturePeriode.CLOTUREE;

    const linkedLignes = await this.prisma.ligneSaisieMensuelle.findMany({
      where: { archiveVersReleveId: id },
    });

    if (existing.rapportPath) {
      const abs = absoluteUploadPath(existing.rapportPath);
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch {
          /* ignore */
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (linkedLignes.length > 0) {
        await tx.ligneSaisieMensuelle.updateMany({
          where: { archiveVersReleveId: id },
          data: {
            archiveVersReleveId: null,
            statutLigne: StatutLigneSaisie.PRET,
          },
        });

        const campagneIds = [...new Set(linkedLignes.map((l) => l.campagneId))];
        for (const campagneId of campagneIds) {
          await tx.campagneSaisie.update({
            where: { id: campagneId },
            data: { cloturee: false },
          });
        }
      }

      await tx.releveCompteur.delete({ where: { id } });
    });

    return {
      ok: true,
      code: existing.code,
      moisFacture: existing.moisFacture,
      imprimanteId: existing.imprimanteId,
      factureRecalculRequise: factureCalculee,
      campagneRouverte: linkedLignes.length > 0,
    };
  }

  async update(id: string, dto: UpdateReadingDto, userId?: string) {
    const existing = await this.findOne(id);
    this.ensureEditable(existing);
    await this.ensurePeriodeOuverte(existing.moisFacture);

    const counters = this.normalizeCounters({
      c112: dto.c112 ?? existing.c112,
      c113: dto.c113 ?? existing.c113,
      c122: dto.c122 ?? existing.c122,
      c123: dto.c123 ?? existing.c123,
      c501: dto.c501 !== undefined ? dto.c501 : existing.c501,
      scanNoir: dto.scanNoir ?? existing.scanNoir,
      scanCouleur: dto.scanCouleur ?? existing.scanCouleur,
      envoi: dto.envoi ?? existing.envoi,
    });

    const dateReleve = dto.dateReleve ?? existing.dateReleve.toISOString().slice(0, 10);
    const motif =
      dto.observationMotif === undefined
        ? existing.observationMotif
        : dto.observationMotif;
    const previous = await this.findPrevious(
      existing.imprimanteId,
      existing.moisFacture,
      dateReleve,
      existing.id,
    );
    const avgs = await this.avgDeltas(existing.imprimanteId, existing.moisFacture);
    const computed = this.compute(counters, previous, motif, avgs);
    const statut = dto.brouillon
      ? StatutReleve.BROUILLON
      : previous
        ? computed.statut
        : StatutReleve.BASE_INITIALE;

    const before = this.auditSnapshot(existing);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.releveCompteur.update({
        where: { id },
        data: {
          dateReleve: dto.dateReleve ? new Date(dto.dateReleve) : undefined,
          heureReleve:
            dto.heureReleve === undefined ? undefined : this.parseHeure(dto.heureReleve),
          ...counters,
          ...computed,
          statut,
          observationMotif: dto.observationMotif === undefined ? undefined : dto.observationMotif,
          observations: dto.observations === undefined ? undefined : dto.observations,
          controleAt: null,
          controleParId: null,
          valideAt: null,
          valideParId: null,
        },
        include: readingInclude,
      });
      await tx.releveAudit.create({
        data: {
          releveId: id,
          userId: userId ?? null,
          action: 'UPDATE',
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(this.auditSnapshot(updated)),
        },
      });
      await syncCampagneLigneFromReleve(tx, updated);
      return updated;
    });
    return row;
  }

  /**
   * Mise à jour depuis une campagne ouverte : déverrouille VALIDE si besoin,
   * puis applique la correction (et synchronise la ligne campagne).
   */
  async updateFromCampaignCorrection(
    id: string,
    dto: UpdateReadingDto,
    userId?: string,
  ) {
    const existing = await this.findOne(id);
    await this.ensurePeriodeOuverte(existing.moisFacture);

    if (existing.statut === StatutReleve.VALIDE) {
      await this.prisma.releveCompteur.update({
        where: { id },
        data: {
          statut: StatutReleve.OK,
          valideAt: null,
          valideParId: null,
        },
      });
      await this.prisma.releveAudit.create({
        data: {
          releveId: id,
          userId: userId ?? null,
          action: 'UNLOCK_FOR_CORRECTION',
          beforeJson: JSON.stringify({ statut: StatutReleve.VALIDE }),
          afterJson: JSON.stringify({ statut: StatutReleve.OK }),
        },
      });
    }

    return this.update(id, dto, userId);
  }

  async acceptAnomaly(id: string, dto: AcceptAnomalyDto, userId?: string) {
    const existing = await this.findOne(id);
    this.ensureEditable(existing);
    if (existing.statut !== StatutReleve.ANOMALIE_COMPTEUR) {
      throw new BadRequestException('Ce releve n est pas en anomalie');
    }
    const row = await this.update(
      id,
      {
        observationMotif: dto.observationMotif,
        observations: dto.observations ?? existing.observations ?? undefined,
        brouillon: false,
      },
      userId,
    );
    await this.prisma.releveAudit.create({
      data: {
        releveId: id,
        userId: userId ?? null,
        action: 'ACCEPT_ANOMALY',
        afterJson: JSON.stringify({
          motif: dto.observationMotif,
          statut: row.statut,
        }),
      },
    });
    return row;
  }

  async markControle(id: string, userId: string) {
    const existing = await this.findOne(id);
    this.ensureEditable(existing);
    const canControl: StatutReleve[] = [
      StatutReleve.OK,
      StatutReleve.A_CONTROLER,
      StatutReleve.BASE_INITIALE,
      StatutReleve.SAISI,
    ];
    if (!canControl.includes(existing.statut)) {
      throw new BadRequestException('Statut incompatible avec le controle');
    }
    const row = await this.prisma.releveCompteur.update({
      where: { id },
      data: {
        statut: StatutReleve.CONTROLE,
        controleAt: new Date(),
        controleParId: userId,
      },
      include: readingInclude,
    });
    await this.prisma.releveAudit.create({
      data: {
        releveId: id,
        userId,
        action: 'CONTROL',
        afterJson: JSON.stringify({ statut: row.statut }),
      },
    });
    return row;
  }

  async markValide(id: string, userId: string) {
    const existing = await this.findOne(id);
    this.ensureEditable(existing);
    const canValidate: StatutReleve[] = [
      StatutReleve.CONTROLE,
      StatutReleve.OK,
      StatutReleve.BASE_INITIALE,
    ];
    if (!canValidate.includes(existing.statut)) {
      throw new BadRequestException(
        'Valider uniquement un relevé contrôlé (ou OK / base initiale)',
      );
    }
    if (existing.statut === StatutReleve.ANOMALIE_COMPTEUR) {
      throw new BadRequestException('Corriger l anomalie avant validation');
    }
    const row = await this.prisma.releveCompteur.update({
      where: { id },
      data: {
        statut: StatutReleve.VALIDE,
        valideAt: new Date(),
        valideParId: userId,
        controleAt: existing.controleAt ?? new Date(),
        controleParId: existing.controleParId ?? userId,
      },
      include: readingInclude,
    });
    await this.prisma.releveAudit.create({
      data: {
        releveId: id,
        userId,
        action: 'VALIDATE',
        afterJson: JSON.stringify({ statut: row.statut }),
      },
    });
    return row;
  }

  async importBatch(dto: ImportReadingsDto, userId?: string) {
    await this.ensurePeriodeOuverte(dto.moisFacture);
    const results: Array<{
      codeImprimante: string;
      code?: string;
      statut?: StatutReleve;
      error?: string;
    }> = [];

    for (const row of dto.rows) {
      try {
        const printer = await this.prisma.imprimante.findUnique({
          where: { code: row.codeImprimante.trim() },
        });
        if (!printer) {
          results.push({ codeImprimante: row.codeImprimante, error: 'Imprimante introuvable' });
          continue;
        }
        const created = await this.create(
          {
            imprimanteId: printer.id,
            moisFacture: dto.moisFacture,
            dateReleve: dto.dateReleve,
            heureReleve: dto.heureReleve,
            c112: row.c112,
            c113: row.c113,
            c122: row.c122,
            c123: row.c123,
            c501: row.c501,
            scanNoir: row.scanNoir,
            scanCouleur: row.scanCouleur,
            envoi: row.envoi,
            observationMotif: row.observationMotif,
            observations: row.observations,
          },
          userId,
        );
        await this.prisma.releveAudit.create({
          data: {
            releveId: created.id,
            userId: userId ?? null,
            action: 'IMPORT',
            afterJson: JSON.stringify({ code: created.code }),
          },
        });
        results.push({
          codeImprimante: row.codeImprimante,
          code: created.code,
          statut: created.statut,
        });
      } catch (e) {
        results.push({
          codeImprimante: row.codeImprimante,
          error: e instanceof Error ? e.message : 'Erreur import',
        });
      }
    }

    return {
      moisFacture: dto.moisFacture,
      total: results.length,
      ok: results.filter((r) => r.code).length,
      erreurs: results.filter((r) => r.error).length,
      lignes: results,
    };
  }

  /** Vue contrôle : écarts, anomalies, file d'attente. */
  async control(mois: string) {
    if (!/^\d{4}-\d{2}$/.test(mois)) {
      throw new BadRequestException('Mois invalide (attendu YYYY-MM)');
    }
    const rows = await this.prisma.releveCompteur.findMany({
      where: { moisFacture: mois },
      include: readingInclude,
      orderBy: { code: 'asc' },
    });

    const lignes = rows.map((r) => ({
      id: r.id,
      code: r.code,
      imprimante: r.imprimante,
      statut: r.statut,
      observationMotif: r.observationMotif,
      totalNoir: r.totalNoir,
      totalCouleur: r.totalCouleur,
      c501: r.c501,
      anomaly: r.statut === StatutReleve.ANOMALIE_COMPTEUR,
      alerteDeltaHaut: r.alerteDeltaHaut,
      copiesNoirBrutes: r.copiesNoirBrutes,
      copiesCouleurBrutes: r.copiesCouleurBrutes,
      copiesNoirFacturer: r.copiesNoirFacturer,
      copiesCouleurFacturer: r.copiesCouleurFacturer,
      aTraiter:
        r.statut === StatutReleve.ANOMALIE_COMPTEUR ||
        r.statut === StatutReleve.A_CONTROLER ||
        r.alerteDeltaHaut,
    }));

    const file = lignes.filter((l) => l.aTraiter);

    return {
      mois,
      lignes,
      file,
      resume: {
        total: lignes.length,
        anomalies: lignes.filter((l) => l.anomaly).length,
        alertesDelta: lignes.filter((l) => l.alerteDeltaHaut).length,
        aControler: lignes.filter((l) => l.statut === StatutReleve.A_CONTROLER).length,
        controles: lignes.filter((l) => l.statut === StatutReleve.CONTROLE).length,
        valides: lignes.filter((l) => l.statut === StatutReleve.VALIDE).length,
        ok: lignes.filter((l) => l.statut === StatutReleve.OK).length,
        bases: lignes.filter((l) => l.statut === StatutReleve.BASE_INITIALE).length,
        aTraiter: file.length,
      },
    };
  }

  controlExportCsv(mois: string) {
    return this.control(mois).then((data) => {
      const header = [
        'code',
        'imprimante',
        'localisation',
        'statut',
        'motif',
        'totalNoir',
        'c501',
        'deltaN_brut',
        'deltaN_facturable',
        'deltaC_brut',
        'deltaC_facturable',
        'alerteDelta',
      ].join(';');
      const lines = data.lignes.map((l) =>
        [
          l.code,
          l.imprimante.code,
          l.imprimante.localisation ?? '',
          l.statut,
          l.observationMotif ?? '',
          l.totalNoir,
          l.c501 ?? '',
          l.copiesNoirBrutes,
          l.copiesNoirFacturer,
          l.copiesCouleurBrutes,
          l.copiesCouleurFacturer,
          l.alerteDeltaHaut ? '1' : '0',
        ].join(';'),
      );
      return { filename: `controle-releves-${mois}.csv`, content: [header, ...lines].join('\n') };
    });
  }

  /** Vue mensuelle + comparaison % vs mois précédent. */
  async monthlyView(query: MonthlyViewQueryDto) {
    const mois = query.mois;
    const prevMois = this.shiftMois(mois, -1);
    const fins = await this.prisma.releveCompteur.findMany({
      where: { moisFacture: mois },
      include: readingInclude,
      orderBy: [{ imprimante: { localisation: 'asc' } }, { code: 'asc' }],
    });

    const prevByPrinter = new Map(
      (
        await this.prisma.releveCompteur.findMany({
          where: { moisFacture: prevMois },
        })
      ).map((r) => [r.imprimanteId, r]),
    );

    const rows = [];
    for (const fin of fins) {
      const debut = await this.findPrevious(
        fin.imprimanteId,
        fin.moisFacture,
        fin.dateReleve.toISOString().slice(0, 10),
        fin.id,
      );
      const deltaNoirBrut = fin.totalNoir - (debut?.totalNoir ?? fin.totalNoir);
      const deltaCouleurBrut = fin.totalCouleur - (debut?.totalCouleur ?? fin.totalCouleur);
      const deltaNoir = debut ? fin.copiesNoirDelta : 0;
      const deltaCouleur = debut ? fin.copiesCouleurDelta : 0;
      const prev = prevByPrinter.get(fin.imprimanteId);
      const prevDeltaN = prev?.copiesNoirDelta ?? null;
      const prevDeltaC = prev?.copiesCouleurDelta ?? null;
      const pctN =
        prevDeltaN && prevDeltaN > 0
          ? Math.round(((deltaNoir - prevDeltaN) / prevDeltaN) * 1000) / 10
          : null;
      const pctC =
        prevDeltaC && prevDeltaC > 0
          ? Math.round(((deltaCouleur - prevDeltaC) / prevDeltaC) * 1000) / 10
          : null;

      rows.push({
        imprimante: fin.imprimante,
        mois,
        debut: debut
          ? {
              code: 'code' in debut ? debut.code : 'BASE_POSE',
              moisFacture: 'moisFacture' in debut ? debut.moisFacture : mois,
              dateReleve: 'dateReleve' in debut
                ? debut.dateReleve
                : `${mois}-01`,
              totalNoir: debut.totalNoir,
              totalCouleur: debut.totalCouleur,
              c112: debut.c112,
              c113: debut.c113,
              c122: debut.c122,
              c123: debut.c123,
            }
          : null,
        fin: {
          id: fin.id,
          code: fin.code,
          dateReleve: fin.dateReleve,
          totalNoir: fin.totalNoir,
          totalCouleur: fin.totalCouleur,
          c112: fin.c112,
          c113: fin.c113,
          c122: fin.c122,
          c123: fin.c123,
          statut: fin.statut,
          alerteDeltaHaut: fin.alerteDeltaHaut,
        },
        delta: {
          noir: deltaNoir,
          couleur: deltaCouleur,
          total: deltaNoir + deltaCouleur,
          noirBrut: debut ? deltaNoirBrut : 0,
          couleurBrut: debut ? deltaCouleurBrut : 0,
          noirFacturer: fin.copiesNoirFacturer,
          couleurFacturer: fin.copiesCouleurFacturer,
          noirInclus: fin.copiesNoirIncluses,
          couleurInclus: fin.copiesCouleurIncluses,
          quotaNoirDispo: fin.quotaNoirDispo,
          quotaCouleurDispo: fin.quotaCouleurDispo,
          quotaNoirReport: fin.quotaNoirReport,
          quotaCouleurReport: fin.quotaCouleurReport,
        },
        comparaison: {
          moisPrecedent: prevMois,
          deltaNoirPrecedent: prevDeltaN,
          deltaCouleurPrecedent: prevDeltaC,
          pctNoir: pctN,
          pctCouleur: pctC,
        },
      });
    }

    const totaux = rows.reduce(
      (acc, r) => {
        acc.deltaNoir += r.delta.noir;
        acc.deltaCouleur += r.delta.couleur;
        return acc;
      },
      { deltaNoir: 0, deltaCouleur: 0 },
    );

    return {
      mois,
      moisPrecedent: prevMois,
      lignes: rows,
      totaux: {
        ...totaux,
        deltaTotal: totaux.deltaNoir + totaux.deltaCouleur,
        nbImprimantes: rows.length,
      },
    };
  }

  /** Matrice imprimantes × mois (compteurs, Δ, quotas). */
  async matrix(moisDebut: string, moisFin: string) {
    if (!/^\d{4}-\d{2}$/.test(moisDebut) || !/^\d{4}-\d{2}$/.test(moisFin)) {
      throw new BadRequestException('Mois invalide (attendu YYYY-MM)');
    }
    if (moisDebut > moisFin) {
      throw new BadRequestException('moisDebut doit être ≤ moisFin');
    }

    const moisList: string[] = [];
    let cur = moisDebut;
    while (cur <= moisFin) {
      moisList.push(cur);
      cur = this.shiftMois(cur, 1);
      if (moisList.length > 36) break;
    }

    const printers = await this.prisma.imprimante.findMany({
      where: { statut: { not: StatutImprimante.RETIREE } },
      include: { marque: true, service: true },
      orderBy: [{ localisation: 'asc' }, { code: 'asc' }],
    });

    const releves = await this.prisma.releveCompteur.findMany({
      where: { moisFacture: { gte: moisDebut, lte: moisFin } },
    });
    const byKey = new Map(releves.map((r) => [`${r.imprimanteId}|${r.moisFacture}`, r]));

    const lignes = printers.map((p) => {
      const cellules: Record<
        string,
        {
          id: string;
          code: string;
          totalNoir: number;
          totalCouleur: number;
          c112: number;
          c113: number;
          c122: number;
          c123: number;
          deltaNoir: number;
          deltaCouleur: number;
          inclusNoir: number;
          inclusCouleur: number;
          facturerNoir: number;
          facturerCouleur: number;
          quotaNoirDispo: number;
          quotaCouleurDispo: number;
          quotaNoirReport: number;
          quotaCouleurReport: number;
          statut: string;
        } | null
      > = {};
      for (const m of moisList) {
        const r = byKey.get(`${p.id}|${m}`);
        cellules[m] = r
          ? {
              id: r.id,
              code: r.code,
              totalNoir: r.totalNoir,
              totalCouleur: r.totalCouleur,
              c112: r.c112,
              c113: r.c113,
              c122: r.c122,
              c123: r.c123,
              deltaNoir: r.copiesNoirDelta,
              deltaCouleur: r.copiesCouleurDelta,
              inclusNoir: r.copiesNoirIncluses,
              inclusCouleur: r.copiesCouleurIncluses,
              facturerNoir: r.copiesNoirFacturer,
              facturerCouleur: r.copiesCouleurFacturer,
              quotaNoirDispo: r.quotaNoirDispo,
              quotaCouleurDispo: r.quotaCouleurDispo,
              quotaNoirReport: r.quotaNoirReport,
              quotaCouleurReport: r.quotaCouleurReport,
              statut: r.statut,
            }
          : null;
      }
      return { imprimante: p, cellules };
    });

    return {
      moisDebut,
      moisFin,
      mois: moisList,
      quotaBase: { noir: 1000, couleur: 2000 },
      lignes,
    };
  }

  private compute(
    counters: CounterSnapshot,
    previous: PreviousSnapshot | null,
    motif?: ObservationReleve | null,
    avgs?: { avgDeltaNoir: number | null; avgDeltaCouleur: number | null },
  ) {
    const result = computeReleve(counters, previous, {
      motif,
      avgDeltaNoir: avgs?.avgDeltaNoir,
      avgDeltaCouleur: avgs?.avgDeltaCouleur,
    });
    const { anomaly: _anomaly, anomalyReasons: _reasons, ...computed } = result;
    if (!previous) {
      return {
        ...computed,
        ancienTotalNoir: null,
        ancienTotalCouleur: null,
        ancienScanNoir: null,
        ancienScanCouleur: null,
        ancienEnvoi: null,
      };
    }
    return {
      ...computed,
      ancienTotalNoir: previous.totalNoir,
      ancienTotalCouleur: previous.totalCouleur,
      ancienScanNoir: previous.scanNoir,
      ancienScanCouleur: previous.scanCouleur,
      ancienEnvoi: previous.envoi,
    };
  }

  private async avgDeltas(imprimanteId: string, moisFacture: string) {
    const rows = await this.prisma.releveCompteur.findMany({
      where: {
        imprimanteId,
        moisFacture: { lt: moisFacture },
        statut: { notIn: [StatutReleve.BROUILLON, StatutReleve.ANOMALIE_COMPTEUR] },
      },
      orderBy: { moisFacture: 'desc' },
      take: 3,
      select: { copiesNoirDelta: true, copiesCouleurDelta: true },
    });
    if (rows.length === 0) return { avgDeltaNoir: null, avgDeltaCouleur: null };
    const avgDeltaNoir =
      rows.reduce((s, r) => s + r.copiesNoirDelta, 0) / rows.length;
    const avgDeltaCouleur =
      rows.reduce((s, r) => s + r.copiesCouleurDelta, 0) / rows.length;
    return { avgDeltaNoir, avgDeltaCouleur };
  }

  private async findPrevious(
    imprimanteId: string,
    moisFacture: string,
    dateReleve: string,
    excludeId?: string,
  ) {
    const prev = await this.prisma.releveCompteur.findFirst({
      where: {
        imprimanteId,
        id: excludeId ? { not: excludeId } : undefined,
        statut: { not: StatutReleve.BROUILLON },
        OR: [
          { moisFacture: { lt: moisFacture } },
          {
            moisFacture,
            dateReleve: { lt: new Date(dateReleve) },
          },
        ],
      },
      orderBy: [{ moisFacture: 'desc' }, { dateReleve: 'desc' }, { createdAt: 'desc' }],
    });

    // Si un relevé précédent existe (OK/CTRL/VALIDE/ANOMALIE), on l’utilise.
    // Sinon (ou si c’est un BASE_INITIALE), on tente le fallback “pose”.
    if (prev && prev.statut !== StatutReleve.BASE_INITIALE) return prev;

    // Fallback : compteurs initiaux (pose) si saisis, pour le 1er relevé facturable.
    const pose = await this.prisma.imprimante.findUnique({
      where: { id: imprimanteId },
      select: {
        compteursInitiauxSaisis: true,
        dateCompteursInitiaux: true,
        c112Init: true,
        c113Init: true,
        c122Init: true,
        c123Init: true,
        c501Init: true,
        scanNoirInit: true,
        scanCouleurInit: true,
        envoiInit: true,
      },
    });

    if (!pose || !printerHasPoseCounters(pose)) return prev ?? null;

    if (pose.dateCompteursInitiaux) {
      const poseDate = new Date(pose.dateCompteursInitiaux);
      const releveDate = new Date(dateReleve);
      if (releveDate < poseDate) return prev ?? null;
    }

    return poseToPreviousSnapshot(pose);
  }

  private normalizeCounters(dto: Partial<CounterSnapshot>): CounterSnapshot {
    return {
      c112: dto.c112 ?? 0,
      c113: dto.c113 ?? 0,
      c122: dto.c122 ?? 0,
      c123: dto.c123 ?? 0,
      c501: dto.c501 ?? null,
      scanNoir: dto.scanNoir ?? 0,
      scanCouleur: dto.scanCouleur ?? 0,
      envoi: dto.envoi ?? 0,
    };
  }

  private async ensurePrinter(id: string) {
    const p = await this.prisma.imprimante.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Imprimante introuvable');
  }

  private async ensurePeriodeOuverte(mois: string) {
    const campagne = await this.prisma.campagneSaisie.findUnique({ where: { mois } });
    if (campagne?.cloturee) {
      throw new BadRequestException(`Periode ${mois} cloturee`);
    }
    const facture = await this.prisma.facturePeriode.findUnique({ where: { mois } });
    if (facture?.statut === StatutFacturePeriode.CLOTUREE) {
      throw new BadRequestException(`Periode ${mois} cloturee (facture)`);
    }
  }

  private ensureDeletable(row: ReleveCompteur) {
    if (LOCKED.includes(row.statut)) {
      throw new ForbiddenException(
        'Relevé validé — suppression impossible (dévalider d’abord si applicable)',
      );
    }
  }

  private async ensureFactureNonCloturee(mois: string) {
    const facture = await this.prisma.facturePeriode.findUnique({ where: { mois } });
    if (facture?.statut === StatutFacturePeriode.CLOTUREE) {
      throw new BadRequestException(`Période ${mois} clôturée (facture) — suppression impossible`);
    }
  }

  private ensureEditable(row: ReleveCompteur) {
    if (LOCKED.includes(row.statut)) {
      throw new ForbiddenException('Releve valide — modification interdite');
    }
  }

  private parseHeure(value?: string | null): Date | null {
    if (!value) return null;
    if (/^\d{1,2}:\d{2}/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('heureReleve invalide');
    }
    return parsed;
  }

  private shiftMois(mois: string, delta: number) {
    const [y, m] = mois.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private auditSnapshot(row: Partial<ReleveCompteur>) {
    return {
      code: row.code,
      statut: row.statut,
      c112: row.c112,
      c113: row.c113,
      c122: row.c122,
      c123: row.c123,
      copiesNoirFacturer: row.copiesNoirFacturer,
      copiesCouleurFacturer: row.copiesCouleurFacturer,
      copiesNoirBrutes: row.copiesNoirBrutes,
      copiesCouleurBrutes: row.copiesCouleurBrutes,
      observationMotif: row.observationMotif,
    };
  }
}
