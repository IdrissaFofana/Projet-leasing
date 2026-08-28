import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @RequirePermission('users', 'read')
  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  findAll() {
    return this.roles.findAll();
  }

  @RequirePermission('users', 'read')
  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN)
  findOne(@Param('id') id: string) {
    return this.roles.findOne(id);
  }

  @RequirePermission('users', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @RequirePermission('users', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @RequirePermission('users', 'delete')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}
