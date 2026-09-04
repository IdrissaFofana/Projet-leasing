import { Controller, Get, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientReportsService } from './client-reports.service';
import { MonthlyReportService } from './monthly-report.service';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.LECTURE,
] as const;

@ApiTags('rapports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: MonthlyReportService,
    private readonly clientReports: ClientReportsService,
  ) {}

  @RequirePermission('reports', 'read')
  @Get('leasing-mensuelle/:mois')
  @Roles(...readRoles)
  async leasingMensuelle(@Param('mois') mois: string) {
    const file = await this.reports.generateLeasingMensuelle(mois);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('reports', 'read')
  @Get('facturation-mensuelle/:mois')
  @Roles(...readRoles)
  async facturationMensuelle(@Param('mois') mois: string) {
    const file = await this.reports.generateFacturationMensuelle(mois);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('reports', 'read')
  @Get('leasing-annuelle/:annee')
  @Roles(...readRoles)
  async leasingAnnuelle(@Param('annee') annee: string) {
    const file = await this.clientReports.generateLeasingAnnuelle(annee);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('reports', 'read')
  @Get('leasing-semestrielle/:annee/:semestre')
  @Roles(...readRoles)
  async leasingSemestrielle(
    @Param('annee') annee: string,
    @Param('semestre') semestre: string,
  ) {
    const file = await this.clientReports.generateLeasingSemestrielle(annee, semestre);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('reports', 'read')
  @Get('leasing-trimestrielle/:annee/:trimestre')
  @Roles(...readRoles)
  async leasingTrimestrielle(
    @Param('annee') annee: string,
    @Param('trimestre') trimestre: string,
  ) {
    const file = await this.clientReports.generateLeasingTrimestrielle(annee, trimestre);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @RequirePermission('reports', 'read')
  @Get('intervention/:id')
  @Roles(...readRoles)
  async intervention(@Param('id') id: string) {
    const file = await this.clientReports.generateIntervention(id);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  /** Modèle PDF statique (données fictives) — validation structure document client. */
  @RequirePermission('reports', 'read')
  @Get('modele/leasing-mensuelle')
  @Roles(...readRoles)
  async modeleLeasingMensuelle() {
    const file = await this.reports.generateTemplateModele();
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
