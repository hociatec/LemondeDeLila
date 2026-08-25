import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../../core/application/helpers/setup-service.helper';
import { RandomService } from '../../../../../core/application/services/random.service';
import type { AbsurdissimesDeckPort } from '../ports/absurdissimes-deck.port';
import type { AbsurdissimesMetadata } from '../../model/les-absurdissimes-state.model';

const DEFAULT_TARGET = 10;

export class AbsurdissimesSetupService {
  constructor(
    private readonly deck: AbsurdissimesDeckPort,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const playerIds = players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player.id);
    const seedMeta = (baseState.metadata ??
      {}) as Partial<AbsurdissimesMetadata>;
    let rngMeta = getRngMeta(seedMeta);
    const whiteCards = this.deck.getWhiteCards();
    const blackCards = this.deck.getBlackCards();
    const shuffledWhite = this.random.shuffle(rngMeta, whiteCards);
    rngMeta = shuffledWhite.meta;
    const shuffledBlack = this.random.shuffle(rngMeta, blackCards);
    rngMeta = shuffledBlack.meta;

    const whiteDeck = [...shuffledWhite.values];
    const blackDeck = [...shuffledBlack.values];

    const blackHands: Record<number, string[]> = {};
    playerIds.forEach((pid) => {
      blackHands[pid] = [];
      for (let i = 0; i < 10 && blackDeck.length; i += 1) {
        blackHands[pid].push(blackDeck.shift()!);
      }
    });

    const judgeIndex = 0;
    const judgeId = playerIds[judgeIndex] ?? null;
    const remainingPlayers = playerIds.filter((pid) => pid !== judgeId);
    const nextPlayerId = remainingPlayers[0] ?? judgeId;

    const metadata: AbsurdissimesMetadata = {
      rng: rngMeta,
      whiteDeck,
      blackDeck,
      discardWhite: [],
      discardBlack: [],
      blackHands,
      currentWhite: whiteDeck.shift() ?? null,
      judgeIndex,
      roundStage: 'play',
      submissions: {},
      scores: playerIds.reduce(
        (acc, pid) => ({ ...acc, [pid]: 0 }),
        {} as Record<number, number>,
      ),
      targetScore: Number(seedMeta.targetScore ?? DEFAULT_TARGET),
      remainingPlayers,
      winnerId: null,
    };

    return {
      ...baseState,
      turn: {
        currentPlayerId: nextPlayerId,
        direction: 1,
      },
      metadata,
    };
  }
}



