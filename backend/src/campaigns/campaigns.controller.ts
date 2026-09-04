import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CampaignsService } from './campaigns.service';
import {
  AddCampaignLignesDto,
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
  @Post(':mois/lignes')
  @Roles(...writeRoles)
  addLignes(@Param('mois') mois: string, @Body() dto: AddCampaignLignesDto) {
    return this.campaigns.addLignes(mois, dto);
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

  @RequirePermission('campaigns', 'read')
  @Get(':mois/lignes/:printerId/rapport')
  @Roles(...readRoles)
  downloadRapportLigne(
    @Param('mois') mois: string,
    @Param('printerId') printerId: string,
  ) {
    return this.campaigns.downloadRapportLigne(mois, printerId);
  }

  @RequirePermission('campaigns', 'update')
  @Post(':mois/lignes/:printerId/rapport')
  @Roles(...writeRoles)
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
  uploadRapportLigne(
    @Param('mois') mois: string,
    @Param('printerId') printerId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.campaigns.uploadRapportLigne(mois, printerId, file);
  }

  @RequirePermission('campaigns', 'update')
  @Delete(':mois/lignes/:printerId')
  @Roles(...writeRoles)
  removeLigne(@Param('mois') mois: string, @Param('printerId') printerId: string) {
    return this.campaigns.removeLigne(mois, printerId);
  }

  @RequirePermission('campaigns', 'update')
  @Post(':mois/reopen')
  @Roles(...writeRoles)
  reopen(@Param('mois') mois: string) {
    return this.campaigns.reopen(mois);
  }

  @RequirePermission('campaigns', 'update')
  @Post(':mois/lignes/:printerId/unlink')
  @Roles(...writeRoles)
  unlinkLigne(
    @Param('mois') mois: string,
    @Param('printerId') printerId: string,
  ) {
    return this.campaigns.unlinkLigne(mois, printerId);
  }

  @RequirePermission('campaigns', 'create')
  @Post(':mois/archive')
  @Roles(...writeRoles)
  archive(@Param('mois') mois: string) {
    return this.campaigns.archive(mois);
  }

  @RequirePermission('campaigns', 'delete')
  @Delete(':mois')
  @Roles(...writeRoles)
  remove(@Param('mois') mois: string) {
    return this.campaigns.remove(mois);
  }
}
