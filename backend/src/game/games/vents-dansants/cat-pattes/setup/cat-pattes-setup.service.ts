import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { CAT_PATTES_DECK, CAT_PATTES_PAWNS } from '../model/cat-pattes-cards';
import type {
  CatPattesBotType,
  CatPattesObstacleType,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';

@Injectable()
export class CatPattesSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const metaSeed = (baseState.metadata ?? {}) as CatPattesMetadata;
    const rng = getRngMeta(metaSeed);
    const deck = CAT_PATTES_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);

    let remainingDeck = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const positions: Record<number, number> = {};
    const points: Record<number, number> = {
      ...((metaSeed?.points ?? {}) as Record<number, number>),
    };
    const obstacles: Record<number, CatPattesObstacleType | null> = {};
    const bots: Record<number, CatPattesBotType[]> = {};
    const hasSun: Record<number, boolean> = {};
    const turboPlayed: Record<number, number> = {};
    const pawnByPlayerId: Record<number, string> = {};

    for (const player of players) {
      if (!player?.id) continue;
      positions[player.id] = 0;
      if (typeof points[player.id] !== 'number') points[player.id] = 0;
      obstacles[player.id] = null;
      bots[player.id] = [];
      hasSun[player.id] = false;
      turboPlayed[player.id] = 0;
      const hand: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        if (!remainingDeck.length) break;
        hand.push(remainingDeck.shift()!);
      }
      hands[player.id] = hand;
    }

    const setupStarterId =
      typeof baseState.turn?.currentPlayerId === 'number'
        ? baseState.turn.currentPlayerId
        : players[0]?.id ?? null;

    const metadata: CatPattesMetadata = {
      rng: updatedRng,
      deck: remainingDeck,
      discard: [],
      hands,
      positions,
      points,
      obstacles,
      bots,
      turboPlayed,
      hasSun,
      pawns: [...CAT_PATTES_PAWNS],
      pawnByPlayerId,
      setupStarterId,
      drawnPlayerId: null,
      winnerId: null,
    };

    const usedForPending = new Set(
      Object.values(metadata.pawnByPlayerId ?? {}).filter((v) => typeof v === 'string'),
    );
    const choicesForPending = (metadata.pawns ?? []).filter((p) => !usedForPending.has(p));
    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players,
      startPlayerId: setupStarterId,
      isAssigned: (playerId) => {
        const player = players.find((p) => p?.id === playerId);
        return Boolean(metadata.pawnByPlayerId?.[playerId]) || this.isBotLike(player);
      },
      pawns: choicesForPending.map((name) => ({ id: name, label: name })),
    });
    const metadataWithBots =
      pendingInfo == null ? this.assignMissingBotPawns(players, metadata) : metadata;
    const next: GameStateEntity = {
      ...baseState,
      metadata: metadataWithBots,
      pending: pendingInfo?.pending ?? null,
      turnIndex:
        pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo?.playerId ?? setupStarterId,
        direction: 1,
      },
    };

    return next;
  }

  private assignMissingBotPawns(
    players: Array<{ id: number; username?: string; isBot?: boolean }>,
    meta: CatPattesMetadata,
  ): CatPattesMetadata {
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    const used = new Set(
      Object.values(assigned).filter((v) => typeof v === 'string' && v.trim().length > 0),
    );
    const pool = Array.isArray(meta.pawns)
      ? meta.pawns.filter((pawn) => !used.has(pawn))
      : [];
    const shuffled = this.random.shuffle(meta as any, pool);
    const shuffledPool = Array.isArray(shuffled.values) ? shuffled.values : [];

    let pawnIndex = 0;
    for (const player of players) {
      if (!player?.id || !this.isBotLike(player)) continue;
      if (assigned[player.id]) continue;
      const nextPawn = shuffledPool[pawnIndex];
      if (!nextPawn) break;
      assigned[player.id] = nextPawn;
      used.add(nextPawn);
      pawnIndex += 1;
    }

    return {
      ...meta,
      rng: (shuffled.meta as any)?.rng ?? meta.rng,
      pawnByPlayerId: assigned,
    };
  }

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '').trim().toLowerCase();
    if (username.includes('bot')) return true;
    const kind = String(player?.kind ?? player?.type ?? '').trim().toLowerCase();
    return kind === 'bot' || kind === 'ai';
  }
}






