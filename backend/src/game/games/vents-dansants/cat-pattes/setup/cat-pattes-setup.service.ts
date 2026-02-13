import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
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
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const metaSeed = (baseState.metadata ?? {}) as CatPattesMetadata;
    const rng = metaSeed.rng ?? {};
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

    const pendingInfo = this.buildPawnPending(players, metadata, setupStarterId);
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

    if (!pendingInfo) return next;
    const chooser = players.find((p) => p?.id === pendingInfo.playerId);
    const chooserName = String((chooser as any)?.username ?? '').trim();
    const chooserLabel =
      chooserName.length > 0 ? chooserName : `Joueur ${pendingInfo.playerId}`;
    return this.core.appendLog(next, `${chooserLabel} doit choisir un pion.`);
  }

  private buildPawnPending(
    players: Array<{ id: number; username?: string }>,
    meta: CatPattesMetadata,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    if (!players.length) return null;
    const startIndex =
      startId != null ? players.findIndex((p) => p?.id === startId) : -1;
    const baseIndex = startIndex >= 0 ? startIndex : 0;
    let nextIndex = -1;
    for (let i = 0; i < players.length; i += 1) {
      const idx = (baseIndex + i) % players.length;
      const pid = players[idx]?.id;
      if (pid == null) continue;
      if (!meta.pawnByPlayerId?.[pid] && !this.isBotLike(players[idx])) {
        nextIndex = idx;
        break;
      }
    }
    if (nextIndex < 0) return null;

    const used = new Set(
      Object.values(meta.pawnByPlayerId ?? {}).filter((v) => typeof v === 'string'),
    );
    const choices = (meta.pawns ?? []).filter((p) => !used.has(p));
    if (!choices.length) return null;

    const chooserId = players[nextIndex].id;
    const chooserName = String((players[nextIndex] as any)?.username ?? '').trim();
    const chooserLabel = chooserName.length > 0 ? chooserName : `Joueur ${chooserId}`;

    return {
      playerId: chooserId,
      turnIndex: nextIndex,
      pending: {
        type: 'choose_pawn',
        playerId: chooserId,
        blocking: true,
        label: `C'est à ${chooserLabel} de choisir son pion.`,
        choices,
        data: {
          pawns: choices.map((name) => ({ id: name, label: name })),
        },
      },
    };
  }

  private assignMissingBotPawns(
    players: Array<{ id: number; username?: string; isBot?: boolean }>,
    meta: CatPattesMetadata,
  ): CatPattesMetadata {
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    const used = new Set(
      Object.values(assigned).filter((v) => typeof v === 'string' && v.trim().length > 0),
    );
    const pool = Array.isArray(meta.pawns) ? [...meta.pawns] : [];

    for (const player of players) {
      if (!player?.id || !this.isBotLike(player)) continue;
      if (assigned[player.id]) continue;
      const nextPawn = pool.find((pawn) => !used.has(pawn));
      if (!nextPawn) break;
      assigned[player.id] = nextPawn;
      used.add(nextPawn);
    }

    return { ...meta, pawnByPlayerId: assigned };
  }

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '').toLowerCase();
    return username.includes('bot');
  }
}
