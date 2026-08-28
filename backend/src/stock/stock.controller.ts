import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateEntreeStockDto,
  CreateEntreesBatchDto,
  CreateModeleCartoucheDto,
  EntreeQueryDto,
  MouvementQueryDto,
  SkuQueryDto,
  UpdateEntreeStockDto,
  UpdateSortieDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

@ApiTags('modeles-cartouches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock/modeles')
export class StockModelesController {
  constructor(private readonly stock: StockService) {}

  @RequirePermission('stock', 'read')
  @Get()
  @Roles(...readRoles)
  findAll() {
    return this.stock.findModeles();
  }

  @RequirePermission('stock', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  create(@Body() dto: CreateModeleCartoucheDto) {
    return this.stock.createModele(dto);
  }
}

@ApiTags('skus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock/skus')
export class StockSkusController {
  constructor(private readonly stock: StockService) {}

  @RequirePermission('stock', 'read')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: SkuQueryDto) {
    return this.stock.findSkus(query);
  }
}

@ApiTags('entrees-stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock/entrees')
export class StockEntreesController {
  constructor(private readonly stock: StockService) {}

  @RequirePermission('stock', 'read')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: EntreeQueryDto) {
    return this.stock.findEntrees(query);
  }

  @RequirePermission('stock', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  create(@Body() dto: CreateEntreeStockDto) {
    return this.stock.createEntree(dto);
  }

  @RequirePermission('stock', 'create')
  @Post('batch')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  createBatch(@Body() dto: CreateEntreesBatchDto) {
    return this.stock.createEntreesBatch(dto);
  }

  @RequirePermission('stock', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  update(@Param('id') id: string, @Body() dto: UpdateEntreeStockDto) {
    return this.stock.updateEntree(id, dto);
  }

  @RequirePermission('stock', 'delete')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  remove(@Param('id') id: string) {
    return this.stock.removeEntree(id);
  }
}

@ApiTags('mouvements-stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock/mouvements')
export class StockMouvementsController {
  constructor(private readonly stock: StockService) {}

  @RequirePermission('stock', 'read')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: MouvementQueryDto) {
    return this.stock.findMouvements(query);
  }
}

@ApiTags('sorties-stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock/sorties')
export class StockSortiesController {
  constructor(private readonly stock: StockService) {}

  @RequirePermission('stock', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  update(@Param('id') id: string, @Body() dto: UpdateSortieDto) {
    return this.stock.updateSortie(id, dto);
  }

  @RequirePermission('stock', 'delete')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  remove(@Param('id') id: string) {
    return this.stock.removeSortie(id);
  }
}
