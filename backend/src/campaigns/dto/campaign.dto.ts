import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ObservationReleve } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: '2026-09' })
  @Matches(/^\d{4}-\d{2}$/)
  mois!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  dateReleve!: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  heureReleve?: string;
}

export class CampaignExportQueryDto {
  @ApiProperty({ enum: ['xlsx', 'pdf'] })
  @IsIn(['xlsx', 'pdf'])
  format!: 'xlsx' | 'pdf';
}

export class UpdateCampaignLigneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c112?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c113?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c122?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c123?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c501?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  c301?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanNoir?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scanCouleur?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  envoi?: number | null;

  @ApiPropertyOptional({ enum: ObservationReleve })
  @IsOptional()
  @IsEnum(ObservationReleve)
  observationMotif?: ObservationReleve | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}
