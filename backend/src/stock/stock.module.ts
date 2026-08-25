import { Module } from '@nestjs/common';
import { SequencesModule } from '../sequences/sequences.module';
import {
  StockEntreesController,
  StockModelesController,
  StockMouvementsController,
  StockSkusController,
  StockSortiesController,
} from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [SequencesModule],
  controllers: [
    StockModelesController,
    StockSkusController,
    StockEntreesController,
    StockMouvementsController,
    StockSortiesController,
  ],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
