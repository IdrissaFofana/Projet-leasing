import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  CurrentUser,
  RequirePermission,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';

class AuditQueryDto {
  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultat?: string;
}

const ALL_ROLES = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
];

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('me')
  @Roles(...ALL_ROLES)
  findMine(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    return this.audit.findForUser(user.id, query.limit ?? 40);
  }

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  findRecent(@Query() query: AuditQueryDto) {
    return this.audit.findRecent({
      limit: query.limit ?? 100,
      userId: query.userId,
      entite: query.entite,
      action: query.action,
      resultat: query.resultat,
    });
  }
}
