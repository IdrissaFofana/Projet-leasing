import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { memoryStorage } from 'multer';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateMaintenanceDto,
  MaintenanceQueryDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('maintenance')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.maintenance.findAll(query);
  }

  @Get('assistance-quota')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  assistanceQuota(@Query('mois') mois?: string) {
    return this.maintenance.assistanceQuota(mois);
  }

  @Get(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findOne(@Param('id') id: string) {
    return this.maintenance.findOne(id);
  }

  @Get(':id/rapport')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  downloadRapport(@Param('id') id: string) {
    return this.maintenance.downloadRapport(id);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  create(@Body() dto: CreateMaintenanceDto) {
    return this.maintenance.create(dto);
  }

  @Post(':id/rapport')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadRapport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.maintenance.uploadRapport(id, file);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenance.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@Param('id') id: string) {
    return this.maintenance.remove(id);
  }
}
