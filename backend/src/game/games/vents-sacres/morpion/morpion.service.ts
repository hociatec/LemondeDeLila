import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type { MorpionMetadata } from './model/morpion.model';
import { MorpionPresenter } from './morpion.presenter';
import type { GameShortcutHint, GameShortcutsContext } from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

@Injectable()
export class MorpionService extends AbstractGameService {
  readonly gameType = 'morpion';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'Morpion';
  readonly description = 'Alignez 3 symboles sur une grille 3×3.';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  constructor(
    registry: GameRegistryService,
    private readonly presenter: MorpionPresenter,
  ) {
    super(registry);
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

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const meta = (state.metadata ?? {}) as MorpionMetadata;
    const size = meta.size ?? 3;
    const board = Array.isArray(meta.board) ? meta.board : [];

    // 1) Win if possible.
    const win = this.findWinningMove(board, size, botPlayerId);
    if (win) {
      return [{ type: 'morpion_play', payload: win }];
    }

    // 2) Block opponent immediate win if possible.
    const opponentId = (state.players ?? [])
      .map((p) => p?.id)
      .find((id) => typeof id === 'number' && id !== botPlayerId) as number | undefined;
    if (opponentId) {
      const block = this.findWinningMove(board, size, opponentId);
      if (block) {
        return [{ type: 'morpion_play', payload: block }];
      }
    }

    // 3) Otherwise, pick center, then corners, then first empty.
    const preferred = [
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    for (const pos of preferred) {
      if (pos.x < 0 || pos.y < 0 || pos.x >= size || pos.y >= size) continue;
      const idx = pos.y * size + pos.x;
      if ((board[idx] ?? 0) === 0) {
        return [{ type: 'morpion_play', payload: pos }];
      }
    }

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = y * size + x;
        if ((board[idx] ?? 0) === 0) {
          return [{ type: 'morpion_play', payload: { x, y } }];
        }
      }
    }

    return [];
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(_ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return [interfaceShortcut('P', 'position'), interfaceShortcut('A', 'play')];
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
    const actorName = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const opponent =
      players.find((p) => p?.id != null && p.id !== actorId) ?? null;
    const opponentId = opponent?.id ?? null;
    const opponentName = opponent?.username ?? (opponentId != null ? `#${opponentId}` : null);
    const glyph = this.glyphForOwner(actorId, players);
    const cellRef = this.toCellRef({ x, y }, size);
    let log = this.appendLog(state.log, `${actorName} place ${glyph} en ${cellRef}.`);
    if (winnerId) {
      log = this.appendLog(log, 'Fin de la manche.');
      log = this.appendLog(log, `Victoire de ${actorName}.`);
      if (opponentName) {
        log = this.appendLog(log, `D\u00e9faite de ${opponentName}.`);
      }
      (nextMeta as any).winnerPlayerId = winnerId;
      (nextMeta as any).winnerId = winnerId;
      if (opponentId != null) {
        (nextMeta as any).outcomesByPlayerId = {
          [String(winnerId)]: 'won',
          [String(opponentId)]: 'lost',
        };
      }
    } else if (isDraw) {
      log = this.appendLog(log, 'Fin de la manche.');
      log = this.appendLog(log, 'Match nul.');
      log = this.appendLog(log, 'Partie termin\u00e9e : match nul.');
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

  private findWinningMove(
    board: number[],
    size: number,
    playerId: number,
  ): { x: number; y: number } | null {
    if (!Array.isArray(board) || board.length < size * size) return null;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = y * size + x;
        if ((board[idx] ?? 0) !== 0) continue;
        const candidate = [...board];
        candidate[idx] = playerId;
        if (this.detectWinner(candidate, size) === playerId) {
          return { x, y };
        }
      }
    }

    return null;
  }

  private appendLog(log: Array<{ message: string; timestamp?: string }> | undefined, message: string) {
    const trimmed = (message ?? '').trim();
    const next = Array.isArray(log) ? [...log] : [];
    if (!trimmed) {
      return next;
    }
    next.push({ message: trimmed, timestamp: new Date().toISOString() });
    return next;
  }

  private toCellRef(pos: { x: number; y: number }, size: number): string {
    const colIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.x)));
    const rowIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.y)));
    const col = String.fromCharCode(65 + colIndex);
    const row = rowIndex + 1;
    return `${col}${row}`;
  }

  private glyphForOwner(ownerId: number, players: any[]): string {
    const player0 = players[0]?.id ?? 1;
    const player1 = players[1]?.id ?? 2;
    if (ownerId === player0) return 'X';
    if (ownerId === player1) return 'O';
    return '@';
  }
}
