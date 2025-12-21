import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { PhaseDefinition } from '../../../../../modules/state/services/phase-engine.service';
import { PhaseEngineService } from '../../../../../modules/state/services/phase-engine.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { DAME_NATURE_PHASES } from '../definitions/rules.definition';
import { DAME_NATURE_VICTORY } from '../definitions/victory.definition';
import type { DameNatureMetadata } from '../model/dame-nature.model';
import { DameNatureSetupService } from '../setup/dame-nature-setup.service';

@Injectable()
export class DameNaturePhaseService {
  private readonly phaseOrder: PhaseDefinition<DameNatureMetadata>[] =
    DAME_NATURE_PHASES;

  constructor(
    private readonly phases: PhaseEngineService<DameNatureMetadata>,
    private readonly victory: VictoryService,
    private readonly setup: DameNatureSetupService,
  ) {}

  advance(state: GameStateEntity): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const current = meta.phaseId ?? 'turn';
    const result = this.phases.advance(state, meta, this.phaseOrder, current);
    const nextMeta: DameNatureMetadata = {
      ...(result.state.metadata as DameNatureMetadata),
      phaseId: result.phaseId,
    };
    return this.applyVictory({ ...result.state, metadata: nextMeta });
  }

  applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const result = this.victory.evaluate(state, DAME_NATURE_VICTORY);
    if (!result || !result.finished) {
      return state;
    }
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const nextMeta: DameNatureMetadata = {
      ...meta,
      victoryId: result.conditionId,
      winnerId: result.winnerId ?? null,
    };
    return {
      ...state,
      metadata: nextMeta,
      status: 'finished',
      turn: { currentPlayerId: null, direction: 1 as const },
    };
  }
}
