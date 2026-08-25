import {
  Body,
  Controller,
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

  @Get('modules')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  modules() {
    return this.users.modulesCatalog();
  }

  @Get('assignees')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  @RequirePermission('maintenance')
  assignees() {
    return this.users.listAssignees();
  }

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(dto, actor.id);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, actor.id);
  }

  @Post(':id/reset-password')
  @Roles(RoleUtilisateur.ADMIN)
  @RequirePermission('users')
  resetPassword(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.resetPassword(id, actor.id);
  }
}
