import { Module } from '@nestjs/common';
import { GamePhaseOrchestratorService } from '../features/state/services/game-phase-orchestrator.service';
import { PhaseEngineService } from '../features/state/services/phase-engine.service';
import { StateMachineService } from '../features/state/services/state-machine.service';

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



