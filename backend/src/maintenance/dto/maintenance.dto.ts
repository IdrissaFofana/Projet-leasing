import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeMaintenance } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

  @ApiPropertyOptional({ description: 'Copieur principal (legacy — préférer imprimanteIds)' })
  @IsOptional()
  @IsString()
  imprimanteId?: string;

  @ApiProperty({ type: [String], description: 'Un ou plusieurs copieurs concernés' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imprimanteIds!: string[];

  @ApiPropertyOptional({ enum: TypeMaintenance, description: 'Type principal (legacy — dérivé de taches si omis)' })
  @IsOptional()
  @IsEnum(TypeMaintenance)
  type?: TypeMaintenance;

  @ApiPropertyOptional({
    enum: TypeMaintenance,
    isArray: true,
    description: 'Une ou plusieurs tâches réalisées sur l’intervention',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TypeMaintenance, { each: true })
  taches?: TypeMaintenance[];

  @ApiPropertyOptional({
    description: 'Panne signalée — assistance hors quota mensuel (plusieurs autorisées)',
  })
  @IsOptional()
  @IsBoolean()
  horsQuota?: boolean;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imprimanteIds?: string[];

  @ApiPropertyOptional({ enum: TypeMaintenance })
  @IsOptional()
  @IsEnum(TypeMaintenance)
  type?: TypeMaintenance;

  @ApiPropertyOptional({ enum: TypeMaintenance, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TypeMaintenance, { each: true })
  taches?: TypeMaintenance[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  horsQuota?: boolean;

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
