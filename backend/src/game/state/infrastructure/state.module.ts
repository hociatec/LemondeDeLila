import { Module } from '@nestjs/common';
import { GamePhaseOrchestratorService } from '../application/services/game-phase-orchestrator.service';
import { PhaseEngineService } from '../application/services/phase-engine.service';
import { StateMachineService } from '../application/services/state-machine.service';

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



