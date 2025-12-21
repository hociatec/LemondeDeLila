import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { MissionNemesisMetadata } from '../model/mission-nemesis.model';

@Injectable()
export class MissionNemesisSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata: MissionNemesisMetadata = {
      ...(baseState.metadata ?? {}),
      gameType: 'mission-nemesis',
      message:
        "Mission Nemesis est en cours d'implémentation. Revenez bientôt.",
    };
    return {
      ...baseState,
      status: baseState.status ?? 'open',
      metadata,
    };
  }
}
