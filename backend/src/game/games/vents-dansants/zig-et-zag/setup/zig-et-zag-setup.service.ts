import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import { ZIG_ET_ZAG_DECK } from '../model/zig-et-zag-cards';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';
import { buildInitialRoundState } from '../round-state.helper';

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
      initialDeckCounts: Object.fromEntries(
        Object.entries(playerDecks).map(([pid, cards]) => [
          Number(pid),
          Array.isArray(cards) ? cards.length : 0,
        ]),
      ),
      roundState: null,
      lastRound: null,
      winnerId: null,
    };

    const roundState = buildInitialRoundState(metadata, players);

    // For bot scheduling: if a bot has an available action (i.e. still has cards),
    // make it the "current player" so the engine can trigger the bot turn.
    const waitingSet = new Set<number>(roundState.waitingPlayers ?? []);
    const bot = players.find((p: any) => p?.isBot && waitingSet.has(p.id));
    const currentPlayerId =
      bot && typeof (bot as any).id === 'number'
        ? (bot as any).id
        : (baseState.turn?.currentPlayerId ?? players[0]?.id ?? null);
    const starterName =
      typeof currentPlayerId === 'number'
        ? players.find((p) => p?.id === currentPlayerId)?.username?.trim() ??
          `Joueur ${currentPlayerId}`
        : null;
    const baseLog = Array.isArray(baseState.log) ? baseState.log : [];
    const log =
      starterName != null && starterName.length > 0
        ? [...baseLog, { message: `C'est au tour de ${starterName}.` }]
        : baseLog;

    return {
      ...baseState,
      log,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: typeof currentPlayerId === 'number' ? currentPlayerId : null,
        direction: 1,
      },
      metadata: {
        ...metadata,
        roundState,
      },
    };
  }
}
