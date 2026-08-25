import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouleurToner, StatutStock } from '@prisma/client';
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
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateModeleCartoucheDto {
  @ApiProperty({ example: 'C-EXV 64' })
  @IsString()
  @MinLength(1)
  modele!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marqueId?: string;

  @ApiPropertyOptional({ example: 'Canon' })
  @IsOptional()
  @IsString()
  marqueNom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refFabricant?: string;
}

export class CreateEntreeStockDto {
  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  dateEntree!: string;

  @ApiPropertyOptional({ description: 'HH:mm ou ISO datetime' })
  @IsOptional()
  @IsString()
  heureEntree?: string;

  @ApiProperty()
  @IsString()
  modeleId!: string;

  @ApiProperty({ enum: CouleurToner })
  @IsEnum(CouleurToner)
  couleur!: CouleurToner;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseurId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class EntreeLigneDto {
  @ApiProperty()
  @IsString()
  modeleId!: string;

  @ApiProperty({ enum: CouleurToner })
  @IsEnum(CouleurToner)
  couleur!: CouleurToner;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte!: number;
}

export class CreateEntreesBatchDto {
  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  dateEntree!: string;

  @ApiPropertyOptional({ description: 'HH:mm ou ISO datetime' })
  @IsOptional()
  @IsString()
  heureEntree?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseurId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ type: [EntreeLigneDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntreeLigneDto)
  lignes!: EntreeLigneDto[];
}

export class SkuQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modeleId?: string;

  @ApiPropertyOptional({ enum: CouleurToner })
  @IsOptional()
  @IsEnum(CouleurToner)
  couleur?: CouleurToner;

  @ApiPropertyOptional({ enum: StatutStock })
  @IsOptional()
  @IsEnum(StatutStock)
  statut?: StatutStock;

  @ApiPropertyOptional({ description: 'true = qteRestante <= seuil (défaut 2)' })
  @IsOptional()
  @IsString()
  alerte?: string;
}

export class EntreeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modeleId?: string;

  @ApiPropertyOptional({ enum: CouleurToner })
  @IsOptional()
  @IsEnum(CouleurToner)
  couleur?: CouleurToner;
}

export class MouvementQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  modeleId!: string;
}

export class UpdateEntreeStockDto {
  @ApiPropertyOptional({ example: '2026-08-24' })
  @IsOptional()
  @IsDateString()
  dateEntree?: string;

  @ApiPropertyOptional({ description: 'HH:mm ou ISO datetime, vide pour effacer' })
  @IsOptional()
  @IsString()
  heureEntree?: string;

  @ApiPropertyOptional({ enum: CouleurToner })
  @IsOptional()
  @IsEnum(CouleurToner)
  couleur?: CouleurToner;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseurId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}

export class UpdateSortieDto {
  @ApiPropertyOptional({ example: '2026-08-24' })
  @IsOptional()
  @IsDateString()
  datePose?: string;

  @ApiPropertyOptional({ description: 'HH:mm ou ISO datetime, vide pour effacer' })
  @IsOptional()
  @IsString()
  heurePose?: string;

  @ApiPropertyOptional({ enum: CouleurToner })
  @IsOptional()
  @IsEnum(CouleurToner)
  couleur?: CouleurToner;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}
