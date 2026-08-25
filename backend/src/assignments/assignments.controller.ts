import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { RequirePermission } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentQueryDto,
  CreateAffectationDto,
  CreateKitDto,
} from './dto/assignment.dto';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @ApiTags('affectations')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: AssignmentQueryDto) {
    return this.assignments.findAll(query);
  }

  @ApiTags('kits-cmyk')
  @Post('kit')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  createKit(@Body() dto: CreateKitDto) {
    return this.assignments.createKit(dto);
  }

  @ApiTags('affectations')
  @Get(':id')
  @Roles(...readRoles)
  findOne(@Param('id') id: string) {
    return this.assignments.findOne(id);
  }

  @ApiTags('affectations')
  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  create(@Body() dto: CreateAffectationDto) {
    return this.assignments.create(dto);
  }
}
