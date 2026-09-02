import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const ASSISTANCES_PAR_MOIS = 1;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function uploadsRoot() {
  return path.join(process.cwd(), 'uploads');
}

export function assertReportFile(file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('Fichier requis (PDF ou image)');
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new BadRequestException('Format non supporté — PDF, JPG, PNG, WEBP ou GIF');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new BadRequestException('Fichier trop volumineux (max 12 Mo)');
  }
}

export function saveReportFile(
  kind: 'releves' | 'maintenance' | 'campagnes',
  file: Express.Multer.File,
): { relativePath: string; originalName: string; mime: string } {
  assertReportFile(file);
  const dir = path.join(uploadsRoot(), kind);
  fs.mkdirSync(dir, { recursive: true });
  const fromName = path.extname(file.originalname).toLowerCase();
  const ext = EXT_BY_MIME[file.mimetype] ?? (fromName || '.bin');
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const absolute = path.join(dir, filename);
  fs.writeFileSync(absolute, file.buffer);
  return {
    relativePath: path.join(kind, filename).replace(/\\/g, '/'),
    originalName: file.originalname || filename,
    mime: file.mimetype,
  };
}

export function absoluteUploadPath(relativePath: string) {
  const safe = relativePath.replace(/\.\./g, '');
  return path.join(uploadsRoot(), safe);
}

export function moisFromDate(d: Date | string) {
  if (typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) {
    return d.slice(0, 7);
  }
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
