import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeMaintenance } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMaintenanceDto {
  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  dateMaintenance!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heureMaintenance?: string;

  @ApiProperty()
  @IsString()
  imprimanteId!: string;

  @ApiProperty({ enum: TypeMaintenance })
  @IsEnum(TypeMaintenance)
  type!: TypeMaintenance;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicienId?: string;

  @ApiPropertyOptional({ description: 'Utilisateur assigné (reçoit la notif)' })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionsRealisees?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  piecesConsommables?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  prochaineMaintenance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class UpdateMaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateMaintenance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heureMaintenance?: string;

  @ApiPropertyOptional({ enum: TypeMaintenance })
  @IsOptional()
  @IsEnum(TypeMaintenance)
  type?: TypeMaintenance;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicienId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionsRealisees?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  piecesConsommables?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  prochaineMaintenance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class MaintenanceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imprimanteId?: string;

  @ApiPropertyOptional({ enum: TypeMaintenance })
  @IsOptional()
  @IsEnum(TypeMaintenance)
  type?: TypeMaintenance;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @IsString()
  moisAssistance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}
