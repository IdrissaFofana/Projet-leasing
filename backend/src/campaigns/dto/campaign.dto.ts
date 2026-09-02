import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ObservationReleve, PorteeCampagne } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
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

  @ApiPropertyOptional({
    enum: PorteeCampagne,
    default: PorteeCampagne.ALL,
    description: 'ALL = tous les copieurs actifs ; SELECTION = liste imprimanteIds',
  })
  @IsOptional()
  @IsEnum(PorteeCampagne)
  portee?: PorteeCampagne;

  @ApiPropertyOptional({
    type: [String],
    description: 'Obligatoire si portee = SELECTION (au moins 1 copieur)',
  })
  @ValidateIf((o: CreateCampaignDto) => o.portee === PorteeCampagne.SELECTION)
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un copieur' })
  @IsString({ each: true })
  imprimanteIds?: string[];
}

export class AddCampaignLignesDto {
  @ApiProperty({
    type: [String],
    description: 'Copieurs à ajouter à la campagne (non déjà présents)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un copieur' })
  @IsString({ each: true })
  imprimanteIds!: string[];
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
