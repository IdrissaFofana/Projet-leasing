import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupStatus, BackupType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BackupQueryDto } from './dto/backup-query.dto';

const execFileAsync = promisify(execFile);

/** Résultat structuré écrit par le script système (sans secrets). */
export type BackupResultPayload = {
  schemaVersion?: number;
  resultKey: string;
  backupId?: string | null;
  status: 'SUCCESS' | 'FAILED';
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
  startedAt: string;
  completedAt: string;
  filename?: string | null;
  size?: number | null;
  destination?: string | null;
  errorMessage?: string | null;
};

function sanitizeError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let msg = String(raw).slice(0, 500);
  msg = msg.replace(/postgresql:\/\/[^\s"']+/gi, '[redacted]');
  msg = msg.replace(/DATABASE_URL[^\n]*/gi, 'DATABASE_URL=[redacted]');
  msg = msg.replace(/password[=:]\s*\S+/gi, 'password=[redacted]');
  msg = msg.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  msg = msg.replace(/client_secret[=:]\s*\S+/gi, 'client_secret=[redacted]');
  return msg;
}

function serializeBackup<T extends { size?: bigint | null }>(row: T) {
  return {
    ...row,
    size: row.size == null ? null : Number(row.size),
  };
}

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private ingestTimer: NodeJS.Timeout | null = null;
  private watchingManual = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const ms = Number(this.config.get('BACKUP_INGEST_MS') ?? 30_000);
    void this.ingestResults().catch((e) =>
      this.logger.warn(`Ingest initial: ${e instanceof Error ? e.message : e}`),
    );
    this.ingestTimer = setInterval(() => {
      void this.ingestResults().catch((e) =>
        this.logger.warn(`Ingest: ${e instanceof Error ? e.message : e}`),
      );
    }, Math.max(5_000, ms));
  }

  onModuleDestroy() {
    if (this.ingestTimer) clearInterval(this.ingestTimer);
  }

  private resultsDir(): string {
    return (
      this.config.get<string>('BACKUP_RESULTS_DIR') ||
      '/var/lib/leasing-backup/results'
    );
  }

  private pendingFile(): string {
    return (
      this.config.get<string>('BACKUP_PENDING_FILE') ||
      '/var/lib/leasing-backup/pending.json'
    );
  }

  private isMock(): boolean {
    const v = (this.config.get<string>('BACKUP_MOCK') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private async ensureDirs() {
    try {
      await mkdir(this.resultsDir(), { recursive: true });
    } catch {
      /* dossier peut être créé au déploiement */
    }
  }

  async findAll(query: BackupQueryDto) {
    await this.ingestResults().catch(() => undefined);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BackupWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      where.startedAt = {};
      if (query.from) where.startedAt.gte = new Date(query.from);
      if (query.to) where.startedAt.lte = new Date(query.to);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.backup.count({ where }),
      this.prisma.backup.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          requestedBy: { select: { id: true, nom: true, email: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map(serializeBackup),
    };
  }

  async findLatest() {
    await this.ingestResults().catch(() => undefined);
    const row = await this.prisma.backup.findFirst({
      orderBy: { startedAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, nom: true, email: true } },
      },
    });
    return row ? serializeBackup(row) : null;
  }

  async findOne(id: string) {
    const row = await this.prisma.backup.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, nom: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Sauvegarde introuvable');
    return serializeBackup(row);
  }

  async hasRunning(): Promise<boolean> {
    const n = await this.prisma.backup.count({
      where: { status: BackupStatus.RUNNING },
    });
    return n > 0;
  }

  async runManual(actor: { id: string; nom: string }) {
    if (await this.hasRunning()) {
      throw new ConflictException('Une sauvegarde est déjà en cours.');
    }

    const startedAt = new Date();
    const backup = await this.prisma.backup.create({
      data: {
        status: BackupStatus.RUNNING,
        type: BackupType.MANUAL,
        startedAt,
        requestedById: actor.id,
      },
      include: {
        requestedBy: { select: { id: true, nom: true, email: true } },
      },
    });

    try {
      await this.ensureDirs();
      await writeFile(
        this.pendingFile(),
        JSON.stringify(
          {
            backupId: backup.id,
            type: 'MANUAL',
            requestedById: actor.id,
            requestedAt: startedAt.toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );

      if (this.isMock()) {
        void this.completeMock(backup.id);
      } else {
        await this.startSystemdService();
        void this.watchManualRun(backup.id);
      }
    } catch (err) {
      const message = sanitizeError(
        err instanceof Error ? err.message : String(err),
      );
      await this.prisma.backup.update({
        where: { id: backup.id },
        data: {
          status: BackupStatus.FAILED,
          completedAt: new Date(),
          errorMessage: message ?? 'Échec du déclenchement de la sauvegarde',
        },
      });
      await this.clearPending().catch(() => undefined);
      throw new ServiceUnavailableException(
        message ?? 'Impossible de démarrer le service de sauvegarde',
      );
    }

    return serializeBackup(backup);
  }

  private async completeMock(backupId: string) {
    await new Promise((r) => setTimeout(r, 1500));
    const key = `mock-${backupId}`;
    const payload: BackupResultPayload = {
      schemaVersion: 1,
      resultKey: key,
      backupId,
      status: 'SUCCESS',
      type: 'MANUAL',
      startedAt: new Date(Date.now() - 1500).toISOString(),
      completedAt: new Date().toISOString(),
      filename: `leasing_mock_${Date.now()}.dump`,
      size: 91081,
      destination: 'Onedrive:Sauvegardes-Leasing/daily',
      errorMessage: null,
    };
    try {
      await this.ensureDirs();
      const path = join(this.resultsDir(), `${key}.json`);
      await writeFile(path, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      await this.applyResult(payload);
    }
    await this.ingestResults();
  }

  private async startSystemdService() {
    const cmd =
      this.config.get<string>('BACKUP_SYSTEMCTL_START') ||
      'sudo -n /bin/systemctl start leasing-backup.service';
    const parts = cmd.split(/\s+/).filter(Boolean);
    const bin = parts[0];
    const args = parts.slice(1);
    try {
      await execFileAsync(bin, args, {
        timeout: 30_000,
        windowsHide: true,
      });
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : 'Échec systemctl start leasing-backup.service';
      throw new Error(
        `Impossible de démarrer leasing-backup.service (${sanitizeError(detail)})`,
      );
    }
  }

  private async watchManualRun(backupId: string) {
    if (this.watchingManual) return;
    this.watchingManual = true;
    const timeoutMs = Number(this.config.get('BACKUP_WATCH_TIMEOUT_MS') ?? 600_000);
    const pollMs = Number(this.config.get('BACKUP_POLL_MS') ?? 2_000);
    const started = Date.now();

    try {
      while (Date.now() - started < timeoutMs) {
        await this.ingestResults().catch(() => undefined);
        const current = await this.prisma.backup.findUnique({
          where: { id: backupId },
        });
        if (!current || current.status !== BackupStatus.RUNNING) {
          return;
        }

        const inactive = await this.isServiceInactive();
        if (inactive) {
          // Dernière chance d'ingest avant de marquer l'échec systemd
          await this.ingestResults().catch(() => undefined);
          const again = await this.prisma.backup.findUnique({
            where: { id: backupId },
          });
          if (again && again.status === BackupStatus.RUNNING) {
            const result = await this.readSystemdResult();
            await this.prisma.backup.update({
              where: { id: backupId },
              data: {
                status: BackupStatus.FAILED,
                completedAt: new Date(),
                errorMessage:
                  result === 'success'
                    ? 'Service terminé sans fichier résultat vérifié (dump/OneDrive)'
                    : `Échec du service de sauvegarde (systemd Result=${result})`,
              },
            });
            await this.clearPending().catch(() => undefined);
          }
          return;
        }

        await new Promise((r) => setTimeout(r, pollMs));
      }

      const stuck = await this.prisma.backup.findUnique({
        where: { id: backupId },
      });
      if (stuck?.status === BackupStatus.RUNNING) {
        await this.prisma.backup.update({
          where: { id: backupId },
          data: {
            status: BackupStatus.FAILED,
            completedAt: new Date(),
            errorMessage: 'Délai dépassé en attendant la fin de la sauvegarde',
          },
        });
        await this.clearPending().catch(() => undefined);
      }
    } finally {
      this.watchingManual = false;
    }
  }

  private async isServiceInactive(): Promise<boolean> {
    const cmd =
      this.config.get<string>('BACKUP_SYSTEMCTL_IS_ACTIVE') ||
      'sudo -n /bin/systemctl is-active leasing-backup.service';
    const parts = cmd.split(/\s+/).filter(Boolean);
    try {
      const { stdout } = await execFileAsync(parts[0], parts.slice(1), {
        timeout: 10_000,
        windowsHide: true,
      });
      const state = stdout.trim();
      return state === 'inactive' || state === 'failed' || state === 'dead';
    } catch (err: unknown) {
      // systemctl is-active returns exit 3 when inactive
      const e = err as { stdout?: string; code?: number };
      const state = String(e.stdout ?? '').trim();
      if (state === 'inactive' || state === 'failed' || state === 'dead') {
        return true;
      }
      if (e.code === 3) return true;
      return false;
    }
  }

  private async readSystemdResult(): Promise<string> {
    const cmd =
      this.config.get<string>('BACKUP_SYSTEMCTL_SHOW') ||
      'sudo -n /bin/systemctl show leasing-backup.service --property=Result --value';
    const parts = cmd.split(/\s+/).filter(Boolean);
    try {
      const { stdout } = await execFileAsync(parts[0], parts.slice(1), {
        timeout: 10_000,
        windowsHide: true,
      });
      return stdout.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async clearPending() {
    try {
      await unlink(this.pendingFile());
    } catch {
      /* ignore */
    }
  }

  /** Ingestion des fichiers JSON produits par le script système. */
  async ingestResults() {
    const dir = this.resultsDir();
    try {
      await access(dir);
    } catch {
      return { ingested: 0 };
    }

    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.processed.json'),
      );
    } catch {
      return { ingested: 0 };
    }

    let ingested = 0;
    for (const file of files) {
      const full = join(dir, file);
      try {
        const raw = await readFile(full, 'utf8');
        const payload = JSON.parse(raw) as BackupResultPayload;
        if (!payload?.resultKey || !payload.status || !payload.type) {
          this.logger.warn(`Résultat invalide: ${file}`);
          continue;
        }
        await this.applyResult(payload);
        ingested += 1;
        const dest = join(dir, `${file}.done`);
        try {
          await rename(full, dest);
        } catch {
          await unlink(full).catch(() => undefined);
        }
      } catch (err) {
        this.logger.warn(
          `Ingest ${file}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { ingested };
  }

  private async applyResult(payload: BackupResultPayload) {
    const status =
      payload.status === 'SUCCESS' ? BackupStatus.SUCCESS : BackupStatus.FAILED;
    const type = payload.type as BackupType;
    const errorMessage = sanitizeError(payload.errorMessage);
    const size =
      payload.size == null || Number.isNaN(Number(payload.size))
        ? null
        : BigInt(Math.max(0, Math.floor(Number(payload.size))));

    const existingByKey = await this.prisma.backup.findUnique({
      where: { resultKey: payload.resultKey },
    });
    if (existingByKey) return existingByKey;

    if (payload.backupId) {
      const existing = await this.prisma.backup.findUnique({
        where: { id: payload.backupId },
      });
      if (existing) {
        const updated = await this.prisma.backup.update({
          where: { id: payload.backupId },
          data: {
            status,
            type: existing.type === BackupType.MANUAL ? BackupType.MANUAL : type,
            completedAt: new Date(payload.completedAt),
            filename: payload.filename ?? null,
            size,
            destination: payload.destination ?? null,
            errorMessage,
            resultKey: payload.resultKey,
            startedAt: payload.startedAt
              ? new Date(payload.startedAt)
              : existing.startedAt,
          },
        });
        await this.clearPending().catch(() => undefined);
        return updated;
      }
    }

    // Sauvegarde automatique (ou manuelle sans id connu)
    const created = await this.prisma.backup.create({
      data: {
        status,
        type,
        startedAt: new Date(payload.startedAt),
        completedAt: new Date(payload.completedAt),
        filename: payload.filename ?? null,
        size,
        destination: payload.destination ?? null,
        errorMessage,
        resultKey: payload.resultKey,
      },
    });
    await this.clearPending().catch(() => undefined);
    return created;
  }
}
