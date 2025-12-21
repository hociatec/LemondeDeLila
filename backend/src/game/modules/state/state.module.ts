import { Module } from '@nestjs/common';
import { StateMachineService } from './services/state-machine.service';
import { PhaseEngineService } from './services/phase-engine.service';
import { GamePhaseOrchestratorService } from './services/game-phase-orchestrator.service';

@Module({
  providers: [
    StateMachineService,
    PhaseEngineService,
    GamePhaseOrchestratorService,
  ],
  exports: [
    StateMachineService,
    PhaseEngineService,
    GamePhaseOrchestratorService,
  ],
})
export class StateModule {}
