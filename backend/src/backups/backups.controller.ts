import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import {
  CurrentUser,
  RequirePermission,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BackupsService } from './backups.service';
import { BackupQueryDto } from './dto/backup-query.dto';

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @RequirePermission('backups', 'read')
  @Get()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findAll(@Query() query: BackupQueryDto) {
    return this.backups.findAll(query);
  }

  @RequirePermission('backups', 'read')
  @Get('latest')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  latest() {
    return this.backups.findLatest();
  }

  @RequirePermission('backups', 'create')
  @Post('run')
  @Roles(RoleUtilisateur.ADMIN)
  run(@CurrentUser() user: AuthUser) {
    return this.backups.runManual({ id: user.id, nom: user.email });
  }

  @RequirePermission('backups', 'read')
  @Get(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findOne(@Param('id') id: string) {
    return this.backups.findOne(id);
  }
}
