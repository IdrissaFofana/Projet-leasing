import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutImprimante } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsBoolean,
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

  @ApiPropertyOptional({
    description: 'Saisir des compteurs initiaux à la pose (point de départ avant le 1er relevé facturable).',
  })
  @IsOptional()
  @IsBoolean()
  compteursInitiauxSaisis?: boolean;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dateCompteursInitiaux?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  c112Init?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  c113Init?: number;
  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  c122Init?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  c123Init?: number;

  @ApiPropertyOptional({ example: 500, nullable: true })
  @IsOptional()
  c501Init?: number | null;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  scanNoirInit?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  scanCouleurInit?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  envoiInit?: number;
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

  @ApiPropertyOptional({ description: 'Active / désactive la saisie des compteurs initiaux.' })
  @IsOptional()
  @IsBoolean()
  compteursInitiauxSaisis?: boolean;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dateCompteursInitiaux?: string | null;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  c112Init?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  c113Init?: number;
  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  c122Init?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  c123Init?: number;

  @ApiPropertyOptional({ example: 500, nullable: true })
  @IsOptional()
  c501Init?: number | null;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  scanNoirInit?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  scanCouleurInit?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  envoiInit?: number;
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
