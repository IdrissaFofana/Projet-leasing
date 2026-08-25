import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouleurToner, MotifAffectation, StatutPose } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AffectationLigneDto {
  @ApiProperty({ enum: CouleurToner })
  @IsEnum(CouleurToner)
  couleur!: CouleurToner;

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte!: number;
}

export class CreateAffectationDto {
  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  datePose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heurePose?: string;

  @ApiProperty()
  @IsString()
  imprimanteId!: string;

  @ApiProperty()
  @IsString()
  modeleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ enum: MotifAffectation })
  @IsOptional()
  @IsEnum(MotifAffectation)
  motif?: MotifAffectation;

  @ApiPropertyOptional({ enum: StatutPose })
  @IsOptional()
  @IsEnum(StatutPose)
  statutPose?: StatutPose;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ type: [AffectationLigneDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AffectationLigneDto)
  lignes!: AffectationLigneDto[];
}

export class CreateKitDto {
  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  datePose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heurePose?: string;

  @ApiProperty()
  @IsString()
  imprimanteId!: string;

  @ApiProperty()
  @IsString()
  modeleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ enum: MotifAffectation })
  @IsOptional()
  @IsEnum(MotifAffectation)
  motif?: MotifAffectation;

  @ApiPropertyOptional({ enum: StatutPose })
  @IsOptional()
  @IsEnum(StatutPose)
  statutPose?: StatutPose;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ example: 1, description: 'Quantité par couleur (défaut 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qteParCouleur?: number;
}

export class AssignmentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imprimanteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modeleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}
