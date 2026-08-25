import {

  Controller,

  Get,

  NotFoundException,

  Param,

  Patch,

  Post,

  Query,

  UseGuards,

} from '@nestjs/common';

import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';

import { RoleUtilisateur } from '@prisma/client';

import { Type } from 'class-transformer';

import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {

  AllowWhileMustChangePassword,

  CurrentUser,

  type AuthUser,

} from '../common/decorators/current-user.decorator';

import { Roles } from '../common/decorators/roles.decorator';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { PermissionsGuard } from '../common/guards/permissions.guard';

import { RolesGuard } from '../common/guards/roles.guard';

import { NotificationsService } from './notifications.service';



class LimitDto {

  @ApiPropertyOptional({ default: 40 })

  @IsOptional()

  @Type(() => Number)

  @IsInt()

  @Min(1)

  @Max(100)

  limit?: number;

}



const ALL_ROLES = [

  RoleUtilisateur.ADMIN,

  RoleUtilisateur.TECHNICIEN,

  RoleUtilisateur.FACTURATION,

  RoleUtilisateur.LECTURE,

];



@ApiTags('notifications')

@ApiBearerAuth()

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)

@Controller('notifications')

export class NotificationsController {

  constructor(private readonly notifications: NotificationsService) {}



  @Get('me')

  @AllowWhileMustChangePassword()

  @Roles(...ALL_ROLES)

  async list(@CurrentUser() user: AuthUser, @Query() query: LimitDto) {

    await this.notifications.syncForUser(user.id, user.role, user.permissions);

    return this.notifications.listMine(user.id, query.limit ?? 40);

  }



  @Get('me/unread-count')

  @AllowWhileMustChangePassword()

  @Roles(...ALL_ROLES)

  async unread(@CurrentUser() user: AuthUser) {

    await this.notifications.syncForUser(user.id, user.role, user.permissions);

    return { count: await this.notifications.unreadCount(user.id) };

  }



  @Post('me/sync')

  @AllowWhileMustChangePassword()

  @Roles(...ALL_ROLES)

  sync(@CurrentUser() user: AuthUser) {

    return this.notifications.syncForUser(user.id, user.role, user.permissions);

  }



  @Post('me/read-all')

  @AllowWhileMustChangePassword()

  @Roles(...ALL_ROLES)

  markAll(@CurrentUser() user: AuthUser) {

    return this.notifications.markAllRead(user.id);

  }



  @Patch(':id/read')

  @AllowWhileMustChangePassword()

  @Roles(...ALL_ROLES)

  async markOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {

    const n = await this.notifications.markRead(user.id, id);

    if (!n) throw new NotFoundException('Notification introuvable');

    return n;

  }

}


