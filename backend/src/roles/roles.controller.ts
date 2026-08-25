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

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  findAll() {
    return this.roles.findAll();
  }

  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  findOne(@Param('id') id: string) {
    return this.roles.findOne(id);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }
}
