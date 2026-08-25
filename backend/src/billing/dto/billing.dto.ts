import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class BillingExportQueryDto {
  @ApiPropertyOptional({ enum: ['json', 'csv', 'xlsx', 'pdf'], default: 'csv' })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx', 'pdf'])
  format?: 'json' | 'csv' | 'xlsx' | 'pdf';
}
