import {
  Controller,
  Get,
  Param,
  Post,
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
import { BillingService } from './billing.service';
import { BillingExportQueryDto } from './dto/billing.dto';

@ApiTags('facturation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('periods')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findAll() {
    return this.billing.findAll();
  }

  @Get('periods/:mois')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findByMois(@Param('mois') mois: string) {
    return this.billing.findByMois(mois);
  }

  @Post('periods/:mois/calculate')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION)
  calculate(@Param('mois') mois: string) {
    return this.billing.calculate(mois);
  }

  @Post('periods/:mois/close')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION)
  close(@Param('mois') mois: string) {
    return this.billing.close(mois);
  }

  @Get('periods/:mois/export')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  async export(@Param('mois') mois: string, @Query() query: BillingExportQueryDto) {
    const result = await this.billing.export(mois, query.format ?? 'csv');
    if (result.kind === 'file') {
      return new StreamableFile(result.buffer, {
        type: result.mime,
        disposition: `attachment; filename="${result.filename}"`,
      });
    }
    if (result.kind === 'json') return result.data;
    return {
      mois: result.mois,
      format: result.format,
      content: result.content,
      montantTotal: result.montantTotal,
      statut: result.statut,
    };
  }
}
