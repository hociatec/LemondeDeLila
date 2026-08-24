import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { PlayerStateEntity } from '../../../../../application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../../application/helpers/setup-service.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { CAT_PATTES_DECK } from '../../model/cat-pattes-cards';
import type {
  CatPattesBotType,
  CatPattesObstacleType,
} from '../../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../../model/cat-pattes-state.model';
import {
  CAT_PATTES_DEFAULT_ROUNDS,
  CAT_PATTES_GOAL,
} from '../../model/cat-pattes-state.model';

export class CatPattesSetupService {
  constructor(
    _core: GameCoreService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const metaSeed = (baseState.metadata ?? {}) as CatPattesMetadata;
    const rng = getRngMeta(metaSeed);
    const deck = CAT_PATTES_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(
      rng,
      deck,
    );

    const remainingDeck = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const positions: Record<number, number> = {};
    const points: Record<number, number> = {
      ...(metaSeed?.points ?? {}),
    };
    const obstacles: Record<number, CatPattesObstacleType | null> = {};
    const bots: Record<number, CatPattesBotType[]> = {};
    const hasSun: Record<number, boolean> = {};
    const sunReady: Record<number, boolean> = {};
    const obstacleLock: Record<number, boolean> = {};
    const turboPlayed: Record<number, number> = {};

    for (const player of players) {
      if (!player?.id) continue;
      positions[player.id] = 0;
      if (typeof points[player.id] !== 'number') points[player.id] = 0;
      obstacles[player.id] = null;
      bots[player.id] = [];
      hasSun[player.id] = false;
      sunReady[player.id] = true;
      obstacleLock[player.id] = false;
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
        : (players[0]?.id ?? null);
    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const ownerPlayerId =
      this.resolveOwnerPlayerId(players, baseMeta) ?? setupStarterId;
    const roundsToPlay = this.resolveRoundsToPlay(metaSeed?.roundsToPlay);

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
      sunReady,
      obstacleLock,
      setupStep: 'setup_config',
      ownerPlayerId,
      goalPattes: CAT_PATTES_GOAL,
      roundsToPlay,
      completedRounds: 0,
      setupStarterId,
      drawnPlayerId: null,
      winnerId: null,
    };
    const next: GameStateEntity = {
      ...baseState,
      metadata,
      pending: {
        type: 'config_prompt',
        playerId: ownerPlayerId,
        blocking: true,
        label: 'Configuration Cat Pattes.',
        choices: [],
        data: {
          title: 'Cat Pattes !',
          actionType: 'cat_pattes_set_config',
          fields: [
            {
              key: 'roundsToPlay',
              label: 'Nombre de manches',
              kind: 'number',
              min: 1,
              max: 20,
              initialText: String(roundsToPlay),
            },
          ],
        },
      },
      turnIndex: baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: ownerPlayerId ?? setupStarterId,
        direction: 1,
      },
    };

    return next;
  }

  private isBotLike(player: PlayerStateEntity | null | undefined): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player.username ?? '')
      .trim()
      .toLowerCase();
    if (username.includes('bot')) return true;
    return false;
  }

  private resolveOwnerPlayerId(
    players: Array<{ id: number; isBot?: boolean }>,
    metadata: Record<string, unknown>,
  ): number | null {
    const pickFirstHuman = (): number | null => {
      const human = players.find((p) => p?.id != null && p.isBot !== true);
      return typeof human?.id === 'number' ? human.id : null;
    };
    const ownerRaw =
      typeof metadata?.ownerPlayerId === 'number'
        ? metadata.ownerPlayerId
        : typeof metadata?.roomOwnerId === 'number'
          ? metadata.roomOwnerId
          : null;
    if (
      typeof ownerRaw === 'number' &&
      players.some((p) => Number(p?.id) === ownerRaw && p?.isBot !== true)
    ) {
      return ownerRaw;
    }
    return pickFirstHuman() ?? players[0]?.id ?? null;
  }

  private resolveRoundsToPlay(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return CAT_PATTES_DEFAULT_ROUNDS;
    const rounded = Math.round(parsed);
    if (rounded < 1 || rounded > 20) return CAT_PATTES_DEFAULT_ROUNDS;
    return rounded;
  }
}



