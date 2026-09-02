import { Module } from '@nestjs/common';
import { ClientReportsService } from './client-reports.service';
import { MonthlyReportService } from './monthly-report.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [MonthlyReportService, ClientReportsService],
  exports: [MonthlyReportService, ClientReportsService],
})
export class ReportsModule {}
