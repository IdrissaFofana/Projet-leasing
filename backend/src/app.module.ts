import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BackupsModule } from './backups/backups.module';
import { BillingModule } from './billing/billing.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrintersModule } from './printers/printers.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReadingsModule } from './readings/readings.module';
import { ReferentielsModule } from './referentiels/referentiels.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SequencesModule } from './sequences/sequences.module';
import { StockModule } from './stock/stock.module';
import { StockProduitsModule } from './stock-produits/stock-produits.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ReferentielsModule,
    SequencesModule,
    PrintersModule,
    StockModule,
    StockProduitsModule,
    AssignmentsModule,
    ReadingsModule,
    CampaignsModule,
    BillingModule,
    ReportsModule,
    MaintenanceModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    MessagesModule,
    RolesModule,
    BackupsModule,
  ],
})
export class AppModule {}
