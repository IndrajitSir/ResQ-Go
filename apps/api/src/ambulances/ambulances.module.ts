import { Module } from '@nestjs/common';
import { AmbulancesController } from './ambulances.controller';
import { AmbulancesService } from './ambulances.service';

@Module({
  controllers: [AmbulancesController],
  providers: [AmbulancesService],
  exports: [AmbulancesService],
})
export class AmbulancesModule {}
