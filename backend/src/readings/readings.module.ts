import { Module } from '@nestjs/common';
import { SequencesModule } from '../sequences/sequences.module';
import { ReadingsController } from './readings.controller';
import { ReadingsExportService } from './readings-export.service';
import { ReadingsService } from './readings.service';

@Module({
  imports: [SequencesModule],
  controllers: [ReadingsController],
  providers: [ReadingsService, ReadingsExportService],
  exports: [ReadingsService],
})
export class ReadingsModule {}
