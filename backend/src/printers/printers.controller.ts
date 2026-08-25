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
import { CreatePrinterDto, PrinterQueryDto, UpdatePrinterDto } from './dto/printer.dto';
import { PrintersService } from './printers.service';

@ApiTags('imprimantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission('printers')
@Controller('printers')
export class PrintersController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findAll(@Query() query: PrinterQueryDto) {
    return this.printers.findAll(query);
  }

  @Get('code/:code')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findByCode(@Param('code') code: string) {
    return this.printers.findByCode(code);
  }

  @Get(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.TECHNICIEN,
    RoleUtilisateur.FACTURATION,
    RoleUtilisateur.LECTURE,
  )
  findOne(@Param('id') id: string) {
    return this.printers.findOne(id);
  }

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  create(@Body() dto: CreatePrinterDto) {
    return this.printers.create(dto);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.TECHNICIEN)
  update(@Param('id') id: string, @Body() dto: UpdatePrinterDto) {
    return this.printers.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  remove(@Param('id') id: string) {
    return this.printers.remove(id);
  }
}
