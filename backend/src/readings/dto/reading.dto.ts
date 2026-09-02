import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ObservationReleve, StatutReleve } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateReadingDto {
  @ApiProperty()
  @IsString()
  imprimanteId!: string;

  @ApiProperty({ example: '2026-08', description: 'YYYY-MM' })
  @Matches(/^\d{4}-\d{2}$/)
  moisFacture!: string;

  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  dateReleve!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heureReleve?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c112?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c113?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c122?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c123?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c501?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanNoir?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanCouleur?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  envoi?: number;

  @ApiPropertyOptional({ enum: ObservationReleve })
  @IsOptional()
  @IsEnum(ObservationReleve)
  observationMotif?: ObservationReleve;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'Enregistrer en brouillon sans finaliser' })
  @IsOptional()
  @IsBoolean()
  brouillon?: boolean;
}

export class UpdateReadingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateReleve?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heureReleve?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c112?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c113?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c122?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c123?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c501?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanNoir?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanCouleur?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  envoi?: number;

  @ApiPropertyOptional({ enum: ObservationReleve })
  @IsOptional()
  @IsEnum(ObservationReleve)
  observationMotif?: ObservationReleve;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  brouillon?: boolean;
}

export class ReadingQueryDto {
  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mois?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imprimanteId?: string;

  @ApiPropertyOptional({ enum: StatutReleve })
  @IsOptional()
  @IsEnum(StatutReleve)
  statut?: StatutReleve;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marqueId?: string;

  @ApiPropertyOptional({ description: 'Filtre localisation (contient)' })
  @IsOptional()
  @IsString()
  localisation?: string;

  @ApiPropertyOptional({ description: 'anomalie|controle|a_saisir|ok' })
  @IsOptional()
  @IsString()
  file?: string;
}

export class MonthlyViewQueryDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(/^\d{4}-\d{2}$/)
  mois!: string;
}

export class MatrixQueryDto {
  @ApiProperty({ example: '2026-01' })
  @Matches(/^\d{4}-\d{2}$/)
  moisDebut!: string;

  @ApiProperty({ example: '2026-04' })
  @Matches(/^\d{4}-\d{2}$/)
  moisFin!: string;
}

export class ReadingsExportQueryDto {
  @ApiProperty({ enum: ['xlsx', 'pdf'] })
  @IsIn(['xlsx', 'pdf'])
  format!: 'xlsx' | 'pdf';

  @ApiProperty({ enum: ['liste', 'mensuelle', 'controle', 'matrice'] })
  @IsIn(['liste', 'mensuelle', 'controle', 'matrice'])
  view!: 'liste' | 'mensuelle' | 'controle' | 'matrice';

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mois?: string;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  moisDebut?: string;

  @ApiPropertyOptional({ example: '2026-04' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  moisFin?: string;

  /** Affichage matrice : compteurs | delta | facturer (comme l’UI) */
  @ApiPropertyOptional({ enum: ['compteurs', 'delta', 'facturer'] })
  @IsOptional()
  @IsIn(['compteurs', 'delta', 'facturer'])
  metric?: 'compteurs' | 'delta' | 'facturer';
}

export class PreviousReadingQueryDto {
  @ApiProperty()
  @IsString()
  imprimanteId!: string;

  @ApiProperty({ example: '2026-08' })
  @Matches(/^\d{4}-\d{2}$/)
  moisFacture!: string;

  @ApiPropertyOptional({ example: '2026-08-24' })
  @IsOptional()
  @IsDateString()
  dateReleve?: string;
}

export class AcceptAnomalyDto {
  @ApiProperty({ enum: ObservationReleve })
  @IsEnum(ObservationReleve)
  observationMotif!: ObservationReleve;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class ImportReadingRowDto {
  @ApiProperty({ description: 'Code imprimante IMP-xxxx' })
  @IsString()
  codeImprimante!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c112?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c113?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c122?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c123?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c501?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanNoir?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanCouleur?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  envoi?: number;

  @ApiPropertyOptional({ enum: ObservationReleve })
  @IsOptional()
  @IsEnum(ObservationReleve)
  observationMotif?: ObservationReleve;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class ImportReadingsDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(/^\d{4}-\d{2}$/)
  moisFacture!: string;

  @ApiProperty({ example: '2026-08-28' })
  @IsDateString()
  dateReleve!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heureReleve?: string;

  @ApiProperty({ type: [ImportReadingRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportReadingRowDto)
  rows!: ImportReadingRowDto[];
}
