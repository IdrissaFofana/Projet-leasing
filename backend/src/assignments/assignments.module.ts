import { Module } from '@nestjs/common';
import { SequencesModule } from '../sequences/sequences.module';
import { StockModule } from '../stock/stock.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [SequencesModule, StockModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
