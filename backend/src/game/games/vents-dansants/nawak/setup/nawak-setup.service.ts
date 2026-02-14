import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { NawakChallengeService } from '../data/nawak-challenge.service';
import type { NawakMetadata } from '../model/nawak-state.entity';

@Injectable()
export class NawakSetupService {
  constructor(private readonly challengeService: NawakChallengeService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const playerIds = players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player!.id);
    const metaSeed = (baseState.metadata ?? {}) as Partial<NawakMetadata>;
    const initialScores: Record<number, number> = {};
    playerIds.forEach((pid) => {
      initialScores[pid] = (metaSeed.scores?.[pid] ?? 0) as number;
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

    const { challenge, meta: withChallenge } = this.challengeService.loadChallenge(meta);
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
