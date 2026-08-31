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
import {
  AllowWhileMustChangePassword,
  CurrentUser,
  RequirePermission,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @AllowWhileMustChangePassword()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  me(@CurrentUser() user: AuthUser) {
    return this.users.findOne(user.id);
  }

  @Patch('me')
  @AllowWhileMustChangePassword()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @RequirePermission('users', 'read')
  @Get('modules')
  @Roles(RoleUtilisateur.ADMIN)
  modules() {
    return this.users.modulesCatalog();
  }

  @RequirePermission('maintenance', 'read')
  @Get('assignees')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  assignees() {
    return this.users.listAssignees();
  }

  @RequirePermission('users', 'read')
  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  findAll() {
    return this.users.findAll();
  }

  @RequirePermission('users', 'read')
  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN)
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @RequirePermission('users', 'create')
  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(dto, actor.id);
  }

  @RequirePermission('users', 'update')
  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, actor.id);
  }

  @RequirePermission('users', 'update')
  @Post(':id/reset-password')
  @Roles(RoleUtilisateur.ADMIN)
  resetPassword(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.resetPassword(id, actor.id);
  }

  @RequirePermission('users', 'delete')
  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.remove(id, actor.id);
  }
}
