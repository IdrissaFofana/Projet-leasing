import { Module } from '@nestjs/common';
import {
  AgentsController,
  ClientsController,
  FournisseursController,
  MarquesController,
  SequencesController,
  ServicesController,
  TarifsController,
} from './referentiels.controller';
import { ReferentielsService } from './referentiels.service';

@Module({
  controllers: [
    MarquesController,
    FournisseursController,
    AgentsController,
    ServicesController,
    ClientsController,
    TarifsController,
    SequencesController,
  ],
  providers: [ReferentielsService],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}
