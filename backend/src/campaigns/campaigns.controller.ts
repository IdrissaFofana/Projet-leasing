import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CampaignsService } from './campaigns.service';
import {
  CampaignExportQueryDto,
  CreateCampaignDto,
  UpdateCampaignLigneDto,
} from './dto/campaign.dto';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

const writeRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
] as const;

@ApiTags('campagnes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @RequirePermission('campaigns', 'read')
  @Get()
  @Roles(...readRoles)
  findAll() {
    return this.campaigns.findAll();
  }

  @RequirePermission('campaigns', 'read')
  @Get(':mois/export')
  @Roles(...readRoles)
  async exportFile(
    @Param('mois') mois: string,
    @Query() query: CampaignExportQueryDto,
  ) {
    const file = await this.campaigns.export(mois, query.format);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('campaigns', 'read')
  @Get(':mois')
  @Roles(...readRoles)
  findByMois(@Param('mois') mois: string) {
    return this.campaigns.findByMois(mois);
  }

  @RequirePermission('campaigns', 'create')
  @Post()
  @Roles(...writeRoles)
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @RequirePermission('campaigns', 'update')
  @Patch(':mois/lignes/:printerId')
  @Roles(...writeRoles)
  updateLigne(
    @Param('mois') mois: string,
    @Param('printerId') printerId: string,
    @Body() dto: UpdateCampaignLigneDto,
  ) {
    return this.campaigns.updateLigne(mois, printerId, dto);
  }

  @RequirePermission('campaigns', 'create')
  @Post(':mois/archive')
  @Roles(...writeRoles)
  archive(@Param('mois') mois: string) {
    return this.campaigns.archive(mois);
  }
}
