import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateStockProduitDto,
  SortieStockProduitDto,
  StockProduitQueryDto,
  UpdateStockProduitDto,
} from './dto/stock-produit.dto';
import { StockProduitsService } from './stock-produits.service';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

const writeRoles = [RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN] as const;

@ApiTags('stock-produits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('stock-produits')
export class StockProduitsController {
  constructor(private readonly stockProduits: StockProduitsService) {}

  @RequirePermission('stock_produits', 'read')
  @Get('summary')
  @Roles(...readRoles)
  summary() {
    return this.stockProduits.summary();
  }

  @RequirePermission('stock_produits', 'read')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: StockProduitQueryDto) {
    return this.stockProduits.findAll(query);
  }

  @RequirePermission('stock_produits', 'read')
  @Get(':id')
  @Roles(...readRoles)
  findOne(@Param('id') id: string) {
    return this.stockProduits.findOne(id);
  }

  @RequirePermission('stock_produits', 'create')
  @Post()
  @Roles(...writeRoles)
  create(@Body() dto: CreateStockProduitDto) {
    return this.stockProduits.create(dto);
  }

  @RequirePermission('stock_produits', 'update')
  @Patch(':id')
  @Roles(...writeRoles)
  update(@Param('id') id: string, @Body() dto: UpdateStockProduitDto) {
    return this.stockProduits.update(id, dto);
  }

  @RequirePermission('stock_produits', 'create')
  @Post(':id/sortie')
  @Roles(...writeRoles)
  sortie(@Param('id') id: string, @Body() dto: SortieStockProduitDto) {
    return this.stockProduits.sortie(id, dto);
  }

  @RequirePermission('stock_produits', 'delete')
  @Delete(':id')
  @Roles(...writeRoles)
  remove(@Param('id') id: string) {
    return this.stockProduits.remove(id);
  }
}
