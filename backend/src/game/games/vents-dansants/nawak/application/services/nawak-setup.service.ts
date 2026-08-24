import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import type { NawakChallengePort } from '../ports/nawak-challenge.port';
import type { NawakMetadata } from '../../model/nawak-state.model';

export class NawakSetupService {
  constructor(private readonly challengeService: NawakChallengePort) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const playerIds = players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player.id);
    const metaSeed = (baseState.metadata ?? {}) as Partial<NawakMetadata>;
    const initialScores: Record<number, number> = {};
    playerIds.forEach((pid) => {
      initialScores[pid] = metaSeed.scores?.[pid] ?? 0;
    });
    const targetScore = Math.max(1, Number(metaSeed.targetScore ?? 5));
    const meta: NawakMetadata = {
      rng: metaSeed.rng ?? {},
      targetScore,
      scores: initialScores,
      currentChallenge: {
        id: '',
        prompt: '',
        answers: ['', '', ''],
      },
      roundStage: 'choose',
      submissions: {},
      votes: {},
      lastRound: null,
      winnerId: null,
    };

    const { challenge, meta: withChallenge } =
      this.challengeService.loadChallenge(meta);
    const metadata: NawakMetadata = {
      ...withChallenge,
      targetScore,
      scores: initialScores,
      currentChallenge: challenge,
      roundStage: 'choose',
      submissions: {},
      votes: {},
      lastRound: null,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}


