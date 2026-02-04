import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import { ZIG_ET_ZAG_DECK } from '../model/zig-et-zag-cards';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';

@Injectable()
export class ZigEtZagSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const metaSeed = (baseState.metadata ?? {}) as ZigEtZagMetadata;
    const rng = metaSeed.rng ?? {};
    const deck = ZIG_ET_ZAG_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);

    const activePlayers = players.filter((player) => typeof player?.id === 'number');
    const playerIds = activePlayers.map((player) => player!.id);
    const playerDecks: Record<number, string[]> = {};
    for (const pid of playerIds) {
      playerDecks[pid] = [];
    }

    let dealIndex = 0;
    for (const cardId of shuffledDeck) {
      if (!playerIds.length) break;
      const pid = playerIds[dealIndex % playerIds.length];
      playerDecks[pid] = [...(playerDecks[pid] ?? []), cardId];
      dealIndex += 1;
    }

    const metadata: ZigEtZagMetadata = {
      rng: updatedRng,
      playerDecks,
      lastRound: null,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}
