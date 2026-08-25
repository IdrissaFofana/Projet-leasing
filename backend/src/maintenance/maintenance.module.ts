import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SequencesModule } from '../sequences/sequences.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [SequencesModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
