import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AcceptAnomalyDto,
  CreateReadingDto,
  ImportReadingsDto,
  MatrixQueryDto,
  MonthlyViewQueryDto,
  PreviousReadingQueryDto,
  ReadingQueryDto,
  ReadingsExportQueryDto,
  UpdateReadingDto,
} from './dto/reading.dto';
import { ReadingsExportService } from './readings-export.service';
import { ReadingsService } from './readings.service';

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

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('readings')
export class ReadingsController {
  constructor(
    private readonly readings: ReadingsService,
    private readonly exports: ReadingsExportService,
  ) {}

  @RequirePermission('readings', 'read')
  @ApiTags('releves')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: ReadingQueryDto) {
    return this.readings.findAll(query);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('vue-mensuelle')
  @Get('monthly-view')
  @Roles(...readRoles)
  monthlyView(@Query() query: MonthlyViewQueryDto) {
    return this.readings.monthlyView(query);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('vue-mensuelle')
  @Get('matrix')
  @Roles(...readRoles)
  matrix(@Query() query: MatrixQueryDto) {
    return this.readings.matrix(query.moisDebut, query.moisFin);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('exports')
  @Get('export')
  @Roles(...readRoles)
  async exportFile(@Query() query: ReadingsExportQueryDto) {
    const file = await this.exports.export({
      format: query.format,
      view: query.view,
      mois: query.mois,
      moisDebut: query.moisDebut,
      moisFin: query.moisFin,
      metric: query.metric,
    });
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('readings', 'read')
  @ApiTags('controle-releves')
  @Get('control')
  @Roles(...readRoles)
  control(@Query('mois') mois: string) {
    return this.readings.control(mois);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('controle-releves')
  @Get('control/export')
  @Roles(...readRoles)
  controlExport(@Query('mois') mois: string) {
    return this.readings.controlExportCsv(mois);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('releves')
  @Get('previous')
  @Roles(...readRoles)
  previous(@Query() query: PreviousReadingQueryDto) {
    return this.readings.previous(query);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('releves')
  @Get(':id')
  @Roles(...readRoles)
  findOne(@Param('id') id: string) {
    return this.readings.findOne(id);
  }

  @RequirePermission('readings', 'read')
  @ApiTags('releves')
  @Get(':id/rapport')
  @Roles(...readRoles)
  downloadRapport(@Param('id') id: string) {
    return this.readings.downloadRapport(id);
  }

  @RequirePermission('readings', 'delete')
  @ApiTags('releves')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@Param('id') id: string) {
    return this.readings.remove(id);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('releves')
  @Post(':id/rapport')
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
  uploadRapport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.readings.uploadRapport(id, file);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('releves')
  @Post()
  @Roles(...writeRoles)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReadingDto) {
    return this.readings.create(dto, user.id);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('releves')
  @Post('import')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION)
  importBatch(@CurrentUser() user: AuthUser, @Body() dto: ImportReadingsDto) {
    return this.readings.importBatch(dto, user.id);
  }

  @RequirePermission('readings', 'update')
  @ApiTags('releves')
  @Patch(':id')
  @Roles(...writeRoles)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReadingDto,
  ) {
    return this.readings.update(id, dto, user.id);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('controle-releves')
  @Post(':id/accept-anomaly')
  @Roles(...writeRoles)
  acceptAnomaly(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AcceptAnomalyDto,
  ) {
    return this.readings.acceptAnomaly(id, dto, user.id);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('controle-releves')
  @Post(':id/control')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION, RoleUtilisateur.TECHNICIEN)
  markControle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.readings.markControle(id, user.id);
  }

  @RequirePermission('readings', 'create')
  @ApiTags('controle-releves')
  @Post(':id/validate')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION)
  markValide(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.readings.markValide(id, user.id);
  }
}
