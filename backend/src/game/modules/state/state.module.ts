import { Module } from '@nestjs/common';
import { StateMachineService } from './services/state-machine.service';
import { PhaseEngineService } from './services/phase-engine.service';

@Module({
  providers: [StateMachineService, PhaseEngineService],
  exports: [StateMachineService, PhaseEngineService],
})
export class StateModule {}
