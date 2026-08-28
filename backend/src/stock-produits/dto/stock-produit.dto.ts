import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutStockProduit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateStockProduitDto {
  @ApiProperty({ example: 'TONER HP LASERJET JAUNE 230A' })
  @IsString()
  @MinLength(1)
  designation!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseur?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qteRecue!: number;

  @ApiPropertyOptional({ example: '2026-08-06' })
  @IsOptional()
  @IsDateString()
  dateReception?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bonReception?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qteLivree?: number;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString()
  dateLivraison?: string;

  @ApiPropertyOptional({ example: 'CNAM' })
  @IsOptional()
  @IsString()
  destinataire?: string;

  @ApiPropertyOptional({ description: 'Client référentiel (destinataire)' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bonLivraison?: string;

  @ApiPropertyOptional({ enum: StatutStockProduit })
  @IsOptional()
  @IsEnum(StatutStockProduit)
  statut?: StatutStockProduit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  statutManuel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class UpdateStockProduitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseur?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qteRecue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  dateReception?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bonReception?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qteLivree?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  dateLivraison?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinataire?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bonLivraison?: string | null;

  @ApiPropertyOptional({ enum: StatutStockProduit })
  @IsOptional()
  @IsEnum(StatutStockProduit)
  statut?: StatutStockProduit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  statutManuel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string | null;
}

export class StockProduitQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: StatutStockProduit })
  @IsOptional()
  @IsEnum(StatutStockProduit)
  statut?: StatutStockProduit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fournisseur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinataire?: string;
}

export class SortieStockProduitDto {
  @ApiProperty({ example: 2, description: 'Quantité à sortir du stock' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qte!: number;

  @ApiPropertyOptional({ example: '2026-08-20' })
  @IsOptional()
  @IsDateString()
  dateLivraison?: string;

  @ApiProperty({ description: 'Client destinataire (référentiel)' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bonLivraison?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}
