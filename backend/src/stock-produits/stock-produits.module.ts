import { Module } from '@nestjs/common';
import { StockProduitsController } from './stock-produits.controller';
import { StockProduitsService } from './stock-produits.service';

@Module({
  controllers: [StockProduitsController],
  providers: [StockProduitsService],
  exports: [StockProduitsService],
})
export class StockProduitsModule {}
