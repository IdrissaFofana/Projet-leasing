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
import { AssignmentsService } from './assignments.service';
import {
  AssignmentQueryDto,
  CreateAffectationDto,
  CreateKitDto,
  UpdateAffectationDto,
} from './dto/assignment.dto';

const readRoles = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
] as const;

const writeRoles = [RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN] as const;

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @RequirePermission('assignments', 'read')
  @ApiTags('affectations')
  @Get()
  @Roles(...readRoles)
  findAll(@Query() query: AssignmentQueryDto) {
    return this.assignments.findAll(query);
  }

  @RequirePermission('assignments', 'create')
  @ApiTags('kits-cmyk')
  @Post('kit')
  @Roles(...writeRoles)
  createKit(@Body() dto: CreateKitDto) {
    return this.assignments.createKit(dto);
  }

  @RequirePermission('assignments', 'read')
  @ApiTags('affectations')
  @Get(':id')
  @Roles(...readRoles)
  findOne(@Param('id') id: string) {
    return this.assignments.findOne(id);
  }

  @RequirePermission('assignments', 'create')
  @ApiTags('affectations')
  @Post()
  @Roles(...writeRoles)
  create(@Body() dto: CreateAffectationDto) {
    return this.assignments.create(dto);
  }

  @RequirePermission('assignments', 'update')
  @ApiTags('affectations')
  @Patch(':id')
  @Roles(...writeRoles)
  update(@Param('id') id: string, @Body() dto: UpdateAffectationDto) {
    return this.assignments.update(id, dto);
  }

  @RequirePermission('assignments', 'delete')
  @ApiTags('affectations')
  @Delete(':id')
  @Roles(...writeRoles)
  remove(@Param('id') id: string) {
    return this.assignments.remove(id);
  }
}
