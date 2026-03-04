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
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';
import {
  applyActionsSequentially,
  normalizeActionType,
} from '../../../actions/action-service.helper';
import {
  pawnPlacement,
  victoryAnnouncement,
} from '../../../core/helpers/game-log-text.helper';
import { normalizeGameLogMessage } from '../../../core/helpers/log-style.helper';
import { MORPION_PAWNS } from './definitions/morpion.pawns';
import { nextRngInt } from '../../../../common/utils/seeded-rng';

@Injectable()
export class MorpionService extends AbstractGameService {
  readonly gameType = 'morpion';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'Morpion';
  readonly description = 'Alignez 3 symboles sur une grille 3×3.';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;
  private static readonly PawnChoices = MORPION_PAWNS;

  constructor(
    registry: GameRegistryService,
    private readonly presenter: MorpionPresenter,
  ) {
    super(registry);
  }

  private autoAssignBotPawns(
    players: Array<{ id: number; isBot?: boolean }>,
    assigned: Record<string, string>,
  ): { map: Record<string, string>; assignedBots: Array<{ playerId: number; pawnId: string }> } {
    const out = { ...(assigned ?? {}) };
    const assignedBots: Array<{ playerId: number; pawnId: string }> = [];
    const used = new Set(Object.values(out));
    for (const bot of (players ?? []).filter((p) => p?.isBot === true)) {
      if (out[String(bot.id)]) continue;
      const pick = MorpionService.PawnChoices.find((p) => !used.has(p.id));
      if (!pick) break;
      out[String(bot.id)] = pick.id;
      used.add(pick.id);
      assignedBots.push({ playerId: bot.id, pawnId: pick.id });
    }
    return { map: out, assignedBots };
  }

  private pickRandomHumanNeedingPawn(
    players: Array<{ id: number; isBot?: boolean }>,
    assigned: Record<string, string>,
    meta: Record<string, unknown>,
  ): { playerId: number | null; meta: Record<string, unknown> } {
    const need = (players ?? []).filter(
      (p) => p?.isBot !== true && typeof p?.id === 'number' && !assigned[String(p.id)],
    );
    if (need.length <= 0) {
      return { playerId: null, meta };
    }
    if (need.length === 1) {
      return { playerId: need[0]!.id, meta };
    }
    const { value: idx, meta: updated } = nextRngInt(meta, need.length);
    return { playerId: need[idx]?.id ?? need[0]!.id, meta: updated };
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = baseState.players ?? [];
    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const botAssigned = this.autoAssignBotPawns(players as any, {});
    const assignedBots = botAssigned.map;
    const { playerId: firstPlayerId, meta: metaAfterPick } =
      this.pickRandomHumanNeedingPawn(players as any, assignedBots, baseMeta);
    const metadata: MorpionMetadata = {
      size: 3,
      board: Array.from({ length: 9 }, () => 0),
      glyphByPlayerId: assignedBots,
      winnerId: null,
      draw: false,
    };
    const pending = firstPlayerId
      ? this.buildChoosePawnPending(players, firstPlayerId, assignedBots)
      : null;

    // Announce bot pawn picks so humans know what each bot is using.
    let log = Array.isArray(baseState.log) ? baseState.log : [];
    for (const entry of botAssigned.assignedBots)
    {
      const botName =
        players.find((p) => p?.id === entry.playerId)?.username ?? `#${entry.playerId}`;
      const pawn = MorpionService.PawnChoices.find((p) => p.id === entry.pawnId) ?? null;
      const pawnLabel = pawn?.label ?? entry.pawnId;
      const glyph = pawn?.glyph ?? '?';
      log = this.appendLog(log, `${botName} choisit le pion ${pawnLabel} (${glyph}).`);
    }

    return {
      ...baseState,
      status: 'started',
      phase: 'play',
      round: baseState.round ?? 1,
      turnIndex: baseState.turnIndex ?? 0,
      lastRoll: null,
      metadata: { ...metaAfterPick, ...(metadata as any) } as any,
      pending,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: firstPlayerId,
        direction: 1,
        label:
          firstPlayerId && pending
            ? `Choix du pion - ${players.find((p) => p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}`
            : firstPlayerId
              ? `Tour de ${players.find((p) => p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}`
              : undefined,
      },
      log,
    };
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) =>
      this.applyOne(next, action),
    );
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const choosePawnPending = this.asChoosePawnPending(state.pending);
    if (choosePawnPending && choosePawnPending.playerId === botPlayerId) {
      const available = this.availablePawnIdsFromPending(choosePawnPending);
      if (available.length > 0) {
        return [{ type: 'choose_pawn', payload: { pawnId: available[0] } }];
      }
      return [];
    }

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
      .find((id) => typeof id === 'number' && id !== botPlayerId);
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

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(_ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return [interfaceShortcut('P', 'position'), interfaceShortcut('A', 'play')];
  }

  private applyOne(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const type = normalizeActionType(action);
    if (type === 'choose_pawn') {
      return this.applyChoosePawn(state, action);
    }

    if (type !== 'morpion_play') {
      return state;
    }

    if (this.asChoosePawnPending(state.pending) != null) {
      return state;
    }

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : (state.turn?.currentPlayerId ?? null);
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

    const board = Array.isArray(meta.board)
      ? [...meta.board]
      : Array.from({ length: size * size }, () => 0);
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
    const actorName =
      players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const opponent =
      players.find((p) => p?.id != null && p.id !== actorId) ?? null;
    const opponentId = opponent?.id ?? null;
    const opponentName =
      opponent?.username ?? (opponentId != null ? `#${opponentId}` : null);
    const glyph = this.glyphForOwner(actorId, players, meta);
    const cellRef = this.toCellRef({ x, y }, size);
    let log = this.appendLog(
      state.log,
      pawnPlacement({
        playerLabel: actorName,
        pawnLabel: glyph,
        position: idx,
        tileLabel: cellRef,
      }),
    );
    if (winnerId) {
      log = this.appendLog(log, 'Fin de la manche.');
      log = this.appendLog(log, victoryAnnouncement(actorName));
      if (opponentName) {
        log = this.appendLog(log, `Défaite de ${opponentName}.`);
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
        currentPlayerId:
          winnerId || isDraw
            ? (state.turn?.currentPlayerId ?? null)
            : nextPlayerId,
        direction: 1,
        label:
          winnerId || isDraw
            ? undefined
            : nextPlayerId
              ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
              : undefined,
      },
    };
  }

  private nextPlayerId(players: any[], actorId: number): number | null {
    if (!Array.isArray(players) || players.length < 2) return actorId;
    const ids = players
      .map((p) => p?.id)
      .filter((id) => typeof id === 'number');
    if (ids.length < 2) return actorId;
    const idx = ids.indexOf(actorId);
    if (idx < 0) return ids[0] ?? null;
    return ids[(idx + 1) % ids.length] ?? null;
  }

  private detectWinner(board: number[], _size: number): number | null {
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

  private appendLog(
    log: Array<{ message: string; timestamp?: string }> | undefined,
    message: string,
  ) {
    const trimmed = normalizeGameLogMessage(message);
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

  private glyphForOwner(
    ownerId: number,
    players: any[],
    meta?: MorpionMetadata,
  ): string {
    const mapped = String((meta?.glyphByPlayerId ?? {})[String(ownerId)] ?? '')
      .trim()
      .toLowerCase();
    const mappedPawn = MorpionService.PawnChoices.find((pawn) => pawn.id === mapped);
    if (mappedPawn?.glyph) {
      return mappedPawn.glyph;
    }
    const player0 = players[0]?.id ?? 1;
    const player1 = players[1]?.id ?? 2;
    if (ownerId === player0) return MorpionService.PawnChoices[0]?.glyph ?? 'V';
    if (ownerId === player1) return MorpionService.PawnChoices[1]?.glyph ?? 'E';
    return '@';
  }

  private applyChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = this.asChoosePawnPending(state.pending);
    if (!pending) {
      return state;
    }

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : (state.turn?.currentPlayerId ?? null);
    if (!actorId || actorId !== pending.playerId) {
      return state;
    }

    const pawnId = this.normalizePawnChoice(
      (action.payload as any)?.pawnId ??
        (action.payload as any)?.pawn ??
        (action.payload as any)?.value,
    );
    if (!pawnId) {
      return state;
    }

    const available = this.availablePawnIdsFromPending(pending);
    if (!available.includes(pawnId)) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const metaAll =
      state.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : {};
    const meta = { ...(metaAll as any) } as MorpionMetadata;
    const glyphByPlayerId = { ...(meta.glyphByPlayerId ?? {}) };
    glyphByPlayerId[String(actorId)] = pawnId;
    const botAssigned = this.autoAssignBotPawns(players as any, glyphByPlayerId);
    const withBotsAssigned = botAssigned.map;

    const pawnLabel =
      MorpionService.PawnChoices.find((pawn) => pawn.id === pawnId)?.label ??
      pawnId;
    const pawnGlyph =
      MorpionService.PawnChoices.find((pawn) => pawn.id === pawnId)?.glyph ?? '?';
    let log = this.appendLog(
      state.log,
      `${players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`} choisit le pion ${pawnLabel} (${pawnGlyph}).`,
    );
    for (const entry of botAssigned.assignedBots)
    {
      const botName =
        players.find((p) => p?.id === entry.playerId)?.username ?? `#${entry.playerId}`;
      const pawn = MorpionService.PawnChoices.find((p) => p.id === entry.pawnId) ?? null;
      const label = pawn?.label ?? entry.pawnId;
      const glyph = pawn?.glyph ?? '?';
      log = this.appendLog(log, `${botName} choisit le pion ${label} (${glyph}).`);
    }

    const { playerId: nextPlayerId, meta: metaAfterPick } =
      this.pickRandomHumanNeedingPawn(players as any, withBotsAssigned, metaAll);

    if (typeof nextPlayerId === 'number') {
      return {
        ...state,
        metadata: { ...metaAfterPick, ...meta, glyphByPlayerId: withBotsAssigned } as any,
        pending: this.buildChoosePawnPending(
          players,
          nextPlayerId,
          withBotsAssigned,
        ),
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: nextPlayerId,
          direction: 1,
          label: `Choix du pion - ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`,
        },
        log,
      };
    }

    const startPlayerId = players[0]?.id ?? null;
    return {
      ...state,
      metadata: { ...metaAfterPick, ...meta, glyphByPlayerId: withBotsAssigned } as any,
      pending: null,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: startPlayerId,
        direction: 1,
        label: startPlayerId
          ? `Tour de ${players.find((p) => p?.id === startPlayerId)?.username ?? `#${startPlayerId}`}`
          : undefined,
      },
      log,
    };
  }

  private buildChoosePawnPending(
    players: any[],
    playerId: number,
    assigned: Record<string, string>,
  ) {
    const taken = new Set(
      Object.values(assigned ?? {})
        .map((v) => this.normalizePawnChoice(v))
        .filter((v): v is string => v != null),
    );
    const available = MorpionService.PawnChoices.filter(
      (c) => !taken.has(c.id),
    );
    const availableLabels = available.map((c) => c.label);
    return {
      type: 'choose_pawn',
      playerId,
      blocking: true,
      label: `Choisissez votre pion (${availableLabels.join(' / ')}).`,
      choices: available.map((c) => `${c.label} - ${c.description}`),
      data: {
        pawns: available.map((c) => ({
          id: c.id,
          label: c.label,
          description: c.description,
          glyph: c.glyph,
        })),
      },
    } as any;
  }

  private asChoosePawnPending(
    pending: unknown,
  ): { playerId: number; data?: Record<string, unknown> } | null {
    if (!pending || typeof pending !== 'object') {
      return null;
    }

    const type = String((pending as any).type ?? '')
      .trim()
      .toLowerCase();
    if (type !== 'choose_pawn') {
      return null;
    }

    const playerId = Number((pending as any).playerId);
    if (!Number.isFinite(playerId)) {
      return null;
    }

    const data =
      (pending as any).data && typeof (pending as any).data === 'object'
        ? ((pending as any).data as Record<string, unknown>)
        : undefined;

    return { playerId, data };
  }

  private availablePawnIdsFromPending(pending: {
    playerId: number;
    data?: Record<string, unknown>;
  }): string[] {
    const pawns = pending.data?.pawns;
    if (!Array.isArray(pawns)) {
      return [];
    }

    return pawns
      .map((entry) => this.normalizePawnChoice(entry?.id))
      .filter((entry): entry is string => entry != null);
  }

  private normalizePawnChoice(value: unknown): string | null {
    let normalized = '';
    if (typeof value === 'string') {
      normalized = value.trim().toLowerCase();
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      normalized = String(value).trim().toLowerCase();
    }

    // Backward compatibility with legacy X/O clients.
    if (normalized === 'x') {
      return MorpionService.PawnChoices[0]?.id ?? null;
    }
    if (normalized === 'o') {
      return MorpionService.PawnChoices[1]?.id ?? null;
    }

    const matched = MorpionService.PawnChoices.find((pawn) => pawn.id === normalized);
    if (matched) {
      return matched.id;
    }

    return null;
  }
}
