import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutImprimante } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePrinterDto {
  @ApiProperty({ example: 'IR-ADV C930' })
  @IsString()
  @MinLength(1)
  modele!: string;

  @ApiProperty({ example: '4MB44679' })
  @IsString()
  @MinLength(1)
  numeroSerie!: string;

  @ApiPropertyOptional({ example: 'Canon' })
  @IsOptional()
  @IsString()
  marqueNom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marqueId?: string;

  @ApiPropertyOptional({ example: 'Batiment Equateur etage 5' })
  @IsOptional()
  @IsString()
  localisation?: string;

  @ApiPropertyOptional({ enum: StatutImprimante, default: StatutImprimante.FONCTIONNELLE })
  @IsOptional()
  @IsEnum(StatutImprimante)
  statut?: StatutImprimante;

  @ApiPropertyOptional({ example: 'ESAY Support' })
  @IsOptional()
  @IsString()
  fournisseurNom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseurId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dateInstallation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  prochaineMaintenance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class UpdatePrinterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  modele?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  numeroSerie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marqueId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localisation?: string | null;

  @ApiPropertyOptional({ enum: StatutImprimante })
  @IsOptional()
  @IsEnum(StatutImprimante)
  statut?: StatutImprimante;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseurId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateInstallation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  prochaineMaintenance?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}

export class PrinterQueryDto {
  @ApiPropertyOptional({ enum: StatutImprimante })
  @IsOptional()
  @IsEnum(StatutImprimante)
  statut?: StatutImprimante;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localisation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marqueId?: string;

  @ApiPropertyOptional({ description: 'Recherche code / modele / n serie' })
  @IsOptional()
  @IsString()
  q?: string;
}
