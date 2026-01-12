import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type { MorpionMetadata } from './model/morpion.model';
import { MorpionPresenter } from './morpion.presenter';

@Injectable()
export class MorpionService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'morpion';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Ents Sacrés';
  readonly displayName = 'Morpion';
  readonly description = 'Alignez 3 symboles sur une grille 3×3.';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly presenter: MorpionPresenter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = baseState.players ?? [];
    const firstPlayerId = players[0]?.id ?? null;
    const metadata: MorpionMetadata = {
      size: 3,
      board: Array.from({ length: 9 }, () => 0),
      winnerId: null,
      draw: false,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'play',
      round: baseState.round ?? 1,
      turnIndex: baseState.turnIndex ?? 0,
      lastRoll: null,
      metadata,
      pending: null,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: firstPlayerId,
        direction: 1,
        label: firstPlayerId
          ? `Tour de ${players.find((p) => p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}`
          : undefined,
      },
      log: Array.isArray(baseState.log) ? baseState.log : [],
    };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const type = String(action?.type ?? '').trim();
    if (type !== 'morpion_play') {
      return state;
    }

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
    if (!actorId) {
      return state;
    }

    const x = Number((action.payload as any)?.x);
    const y = Number((action.payload as any)?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return state;
    }

    const meta = { ...(state.metadata ?? {}) } as MorpionMetadata;
    const size = meta.size ?? 3;
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return state;
    }

    const board = Array.isArray(meta.board) ? [...meta.board] : Array.from({ length: size * size }, () => 0);
    const idx = y * size + x;
    if (board[idx] !== 0) {
      return state;
    }

    board[idx] = actorId;

    const winnerId = this.detectWinner(board, size);
    const isDraw = !winnerId && board.every((v) => (v ?? 0) !== 0);

    const players = state.players ?? [];
    const nextPlayerId = this.nextPlayerId(players, actorId);

    const nextMeta: MorpionMetadata = {
      ...meta,
      board,
      winnerId: winnerId ?? null,
      draw: isDraw,
    };

    const nextStatus = winnerId || isDraw ? 'finished' : state.status;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    const actorName = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    if (winnerId) {
      log.push({ message: `${actorName} gagne !` });
      (nextMeta as any).winnerPlayerId = winnerId;
      (nextMeta as any).winnerId = winnerId;
    } else if (isDraw) {
      log.push({ message: 'Match nul.' });
    }

    return {
      ...state,
      status: nextStatus,
      metadata: nextMeta as any,
      log,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: winnerId || isDraw ? state.turn?.currentPlayerId ?? null : nextPlayerId,
        direction: 1,
        label: winnerId || isDraw
          ? undefined
          : nextPlayerId
            ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
            : undefined,
      },
    };
  }

  private nextPlayerId(players: any[], actorId: number): number | null {
    if (!Array.isArray(players) || players.length < 2) return actorId;
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (ids.length < 2) return actorId;
    const idx = ids.indexOf(actorId);
    if (idx < 0) return ids[0] ?? null;
    return ids[(idx + 1) % ids.length] ?? null;
  }

  private detectWinner(board: number[], size: number): number | null {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      const v = board[a] ?? 0;
      if (v && v === (board[b] ?? 0) && v === (board[c] ?? 0)) {
        return v;
      }
    }
    return null;
  }
}

