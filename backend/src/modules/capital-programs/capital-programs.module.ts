import { Module } from '@nestjs/common';
import { CapitalProgramsController } from './capital-programs.controller';
import { CapitalProgramsService } from './capital-programs.service';

@Module({
  controllers: [CapitalProgramsController],
  providers: [CapitalProgramsService],
})
export class CapitalProgramsModule {}
