import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateNamedDto, UpdateNamedDto } from './dto/named.dto';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { CreateTarifDto, UpdateTarifDto } from './dto/tarif.dto';
import { ReferentielsService } from './referentiels.service';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

@ApiTags('marques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('marques')
export class MarquesController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listNamed('marque');
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateNamedDto) {
    return this.ref.createNamed('marque', dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNamedDto) {
    return this.ref.updateNamed('marque', id, dto);
  }
}

@ApiTags('fournisseurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('fournisseurs')
export class FournisseursController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listNamed('fournisseur');
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateNamedDto) {
    return this.ref.createNamed('fournisseur', dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNamedDto) {
    return this.ref.updateNamed('fournisseur', id, dto);
  }
}

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listNamed('agent');
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateNamedDto) {
    return this.ref.createNamed('agent', dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNamedDto) {
    return this.ref.updateNamed('agent', id, dto);
  }
}

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listNamed('service');
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateNamedDto) {
    return this.ref.createNamed('service', dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNamedDto) {
    return this.ref.updateNamed('service', id, dto);
  }
}

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listClients();
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateClientDto) {
    return this.ref.createClient(dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.ref.updateClient(id, dto);
  }

  @RequirePermission('referentiels', 'delete')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@Param('id') id: string) {
    return this.ref.removeClient(id);
  }
}

@ApiTags('tarifs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('tarifs')
export class TarifsController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(...readRoles)
  list() {
    return this.ref.listTarifs();
  }

  @RequirePermission('referentiels', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateTarifDto) {
    return this.ref.createTarif(dto);
  }

  @RequirePermission('referentiels', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.FACTURATION)
  update(@Param('id') id: string, @Body() dto: UpdateTarifDto) {
    return this.ref.updateTarif(id, dto);
  }
}

@ApiTags('sequences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('sequences')
export class SequencesController {
  constructor(private readonly ref: ReferentielsService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  list() {
    return this.ref.listSequences();
  }
}
