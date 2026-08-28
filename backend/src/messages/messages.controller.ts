import {
  Body,
  Controller,
  Get,
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
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMessageDto } from './dto/message.dto';
import { MessagesService } from './messages.service';

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

@ApiTags('messagerie')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @RequirePermission('messages', 'read')
  @Get('directory')
  @Roles(...ALL_ROLES)
  directory(@CurrentUser() user: AuthUser) {
    return this.messages.directory(user.id);
  }

  @RequirePermission('messages', 'read')
  @Get('conversations')
  @Roles(...ALL_ROLES)
  conversations(@CurrentUser() user: AuthUser) {
    return this.messages.conversations(user.id);
  }

  @RequirePermission('messages', 'read')
  @Get('conversations/:peerId')
  @Roles(...ALL_ROLES)
  thread(@CurrentUser() user: AuthUser, @Param('peerId') peerId: string) {
    return this.messages.thread(user.id, peerId);
  }

  @RequirePermission('messages', 'read')
  @Get('inbox')
  @Roles(...ALL_ROLES)
  inbox(@CurrentUser() user: AuthUser, @Query() query: LimitDto) {
    return this.messages.inbox(user.id, query.limit ?? 40);
  }

  @RequirePermission('messages', 'read')
  @Get('sent')
  @Roles(...ALL_ROLES)
  sent(@CurrentUser() user: AuthUser, @Query() query: LimitDto) {
    return this.messages.sent(user.id, query.limit ?? 40);
  }

  @RequirePermission('messages', 'read')
  @Get('unread-count')
  @Roles(...ALL_ROLES)
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.messages.unreadCount(user.id) };
  }

  @RequirePermission('messages', 'create')
  @Post()
  @Roles(...ALL_ROLES)
  send(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.messages.send(user.id, dto);
  }

  @RequirePermission('messages', 'update')
  @Patch(':id/read')
  @Roles(...ALL_ROLES)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.markRead(user.id, id);
  }
}
