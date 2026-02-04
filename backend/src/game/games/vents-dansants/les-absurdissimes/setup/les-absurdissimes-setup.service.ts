import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import { AbsurdissimesDeckService } from '../data/absurdissimes-deck.service';
import type { AbsurdissimesMetadata } from '../model/les-absurdissimes-state.entity';

const DEFAULT_TARGET = 10;

@Injectable()
export class AbsurdissimesSetupService {
  constructor(
    private readonly deck: AbsurdissimesDeckService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const playerIds = players.filter((player) => typeof player?.id === 'number').map((player) => player!.id);
    const seedMeta = (baseState.metadata ?? {}) as Partial<AbsurdissimesMetadata>;
    let rngMeta = seedMeta.rng ?? {};
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
      scores: playerIds.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {} as Record<number, number>),
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
