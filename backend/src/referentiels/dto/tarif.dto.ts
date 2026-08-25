import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeTarif } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateTarifDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libelle?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  devise?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CreateTarifDto {
  @ApiProperty({ enum: TypeTarif })
  @IsEnum(TypeTarif)
  type!: TypeTarif;

  @ApiProperty()
  @IsString()
  libelle!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prixUnitaire!: number;

  @ApiPropertyOptional({ default: 'XOF' })
  @IsOptional()
  @IsString()
  devise?: string;
}
