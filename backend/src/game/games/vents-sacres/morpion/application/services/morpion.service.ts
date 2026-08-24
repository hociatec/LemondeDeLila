import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type { MorpionMetadata } from '../../model/morpion.model';
import { MorpionPresenter } from './morpion.presenter';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import { interfaceShortcut } from '../../../../../application/helpers/shortcut-utils';
import {
  applyActionsSequentially,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import {
  starterTurnAnnouncement,
  victoryAnnouncement,
} from '../../../../../application/helpers/game-log-text.helper';
import { normalizeGameLogMessage } from '../../../../../application/helpers/log-style.helper';
import { MORPION_PAWNS } from '../../definitions/morpion.pawns';
import { nextRngInt } from '../../../../../../common/utils/public-api';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../application/helpers/configured-pawn-setup.helper';

type MorpionPlayer = {
  id: number;
  username?: string;
  isBot?: boolean;
};

type MorpionActionMeta = {
  actorId?: number;
};

type MorpionPlayPayload = {
  x?: number | string;
  y?: number | string;
};

type MorpionChoosePawnPayload = {
  pawnId?: string | number;
  pawn?: string | number;
  value?: string | number;
};

type MorpionPendingChoice = {
  id?: string | number;
};

type MorpionChoosePawnPending = {
  type?: string;
  playerId: number;
  data?: {
    pawns?: MorpionPendingChoice[];
  };
};

type MorpionRuntimeMetadata = MorpionMetadata & {
  winnerPlayerId?: number | null;
  outcomesByPlayerId?: Record<string, string>;
};

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
    private readonly presenter: MorpionPresenter,
    private readonly core: GameCoreService,
    private readonly setupFlow: SetupFlowService,
  ) {
    super();
  }

  private pickRandomHumanNeedingPawn(
    players: Array<{ id: number; isBot?: boolean }>,
    assigned: Record<string, string>,
    meta: Record<string, unknown>,
  ): { playerId: number | null; meta: Record<string, unknown> } {
    const need = (players ?? []).filter(
      (p) =>
        p?.isBot !== true &&
        typeof p?.id === 'number' &&
        !assigned[String(p.id)],
    );
    if (need.length <= 0) {
      return { playerId: null, meta };
    }
    if (need.length === 1) {
      return { playerId: need[0].id, meta };
    }
    const { value: idx, meta: updated } = nextRngInt(meta, need.length);
    return { playerId: need[idx]?.id ?? need[0].id, meta: updated };
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const baseStateWithCatalog: GameStateEntity = {
      ...baseState,
      metadata: {
        ...baseMeta,
        pawns: MorpionService.PawnChoices.map((pawn) => ({
          id: pawn.id,
          label: pawn.label,
          description: pawn.description,
          glyph: pawn.glyph,
        })),
      },
    };
    const withBots = assignConfiguredBotPawns({
      state: baseStateWithCatalog,
      core: this.core,
      catalog: MorpionService.PawnChoices.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
        glyph: pawn.glyph,
      })),
      metadataAssignmentKey: 'glyphByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      logLabelResolver: (choice) => String(choice.label ?? choice.id).trim(),
    });
    const assignedBots =
      ((withBots.metadata as MorpionMetadata | undefined)?.glyphByPlayerId ??
        {}) as Record<string, string>;
    const { playerId: firstPlayerId, meta: metaAfterPick } =
      this.pickRandomHumanNeedingPawn(
        (withBots.players ?? []) as MorpionPlayer[],
        assignedBots,
        withBots.metadata as Record<string, unknown>,
      );
    const metadata: MorpionMetadata = {
      size: 3,
      board: Array.from({ length: 9 }, () => 0),
      glyphByPlayerId: assignedBots,
      winnerId: null,
      draw: false,
    };
    const initialized: GameStateEntity = {
      ...withBots,
      status: 'started',
      phase: 'play',
      round: baseState.round ?? 1,
      turnIndex: baseState.turnIndex ?? 0,
      lastRoll: null,
      metadata: { ...metaAfterPick, ...metadata },
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: firstPlayerId,
        direction: 1,
      },
    };
    const queued = queueConfiguredPawnSelection({
      state: initialized,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: MorpionService.PawnChoices.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
      })),
      startPlayerId: firstPlayerId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'glyphByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label: String(choice.label ?? '').trim(),
        description: String(choice.description ?? '').trim(),
      }),
    });
    return queued.pending
      ? queued
      : {
          ...queued,
          pending: null,
          turn: {
            ...(queued.turn ?? { direction: 1 }),
            currentPlayerId: firstPlayerId,
            direction: 1,
          },
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

  getShortcuts(_ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
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

    const actionMeta = (action.meta ?? {}) as MorpionActionMeta;
    const actorId =
      typeof actionMeta.actorId === 'number'
        ? actionMeta.actorId
        : (state.turn?.currentPlayerId ?? null);
    if (!actorId) {
      return state;
    }

    const payload = (action.payload ?? {}) as MorpionPlayPayload;
    const x = Number(payload.x);
    const y = Number(payload.y);
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

    const nextMeta: MorpionRuntimeMetadata = {
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
    const pawnLabel = this.pawnLabelForOwner(actorId, players, meta);
    const cellRef = this.toCellRef({ x, y }, size);
    let log = this.appendLog(
      state.log,
      `${actorName} place ${pawnLabel} en ${cellRef}.`,
    );
    if (winnerId) {
      log = this.appendLog(log, 'Fin de la partie.');
      log = this.appendLog(log, victoryAnnouncement(actorName));
      if (opponentName) {
        log = this.appendLog(log, `Défaite de ${opponentName}.`);
      }
      nextMeta.winnerPlayerId = winnerId;
      nextMeta.winnerId = winnerId;
      if (opponentId != null) {
        nextMeta.outcomesByPlayerId = {
          [String(winnerId)]: 'won',
          [String(opponentId)]: 'lost',
        };
      }
    } else if (isDraw) {
      log = this.appendLog(log, 'Fin de la partie.');
      log = this.appendLog(log, 'Match nul.');
      log = this.appendLog(log, 'Partie termin\u00e9e : match nul.');
    }

    return {
      ...state,
      status: nextStatus,
      metadata: nextMeta,
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

  private nextPlayerId(players: MorpionPlayer[], actorId: number): number | null {
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
    // Align with other grid games (ex: Corridor): row numbers go from top (size) to bottom (1).
    // Internal y grows downward (0 at top), so invert for human-readable coordinates.
    const row = Math.max(1, size - rowIndex);
    return `${col}${row}`;
  }

  private glyphForOwner(
    ownerId: number,
    players: MorpionPlayer[],
    meta?: MorpionMetadata,
  ): string {
    const mapped = String((meta?.glyphByPlayerId ?? {})[String(ownerId)] ?? '')
      .trim()
      .toLowerCase();
    const mappedPawn = MorpionService.PawnChoices.find(
      (pawn) => pawn.id === mapped,
    );
    if (mappedPawn?.glyph) {
      return mappedPawn.glyph;
    }
    const player0 = players[0]?.id ?? 1;
    const player1 = players[1]?.id ?? 2;
    if (ownerId === player0) return MorpionService.PawnChoices[0]?.glyph ?? 'V';
    if (ownerId === player1) return MorpionService.PawnChoices[1]?.glyph ?? 'E';
    return '@';
  }

  private pawnLabelForOwner(
    ownerId: number,
    players: MorpionPlayer[],
    meta?: MorpionMetadata,
  ): string {
    const pawnId = String((meta?.glyphByPlayerId ?? {})[String(ownerId)] ?? '')
      .trim()
      .toLowerCase();
    const pawn =
      MorpionService.PawnChoices.find((p) => p.id === pawnId) ?? null;
    if (pawn?.label) return pawn.label;
    if (pawnId) return pawnId;
    return this.glyphForOwner(ownerId, players, meta);
  }

  private applyChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = this.asChoosePawnPending(state.pending);
    if (!pending) {
      return state;
    }

    const actionMeta = (action.meta ?? {}) as MorpionActionMeta;
    const actorId =
      typeof actionMeta.actorId === 'number'
        ? actionMeta.actorId
        : (state.turn?.currentPlayerId ?? null);
    if (!actorId || actorId !== pending.playerId) {
      return state;
    }

    const payload = (action.payload ?? {}) as MorpionChoosePawnPayload;
    const pawnId = this.normalizePawnChoice(
      payload.pawnId ?? payload.pawn ?? payload.value,
    );
    if (!pawnId) {
      return state;
    }

    const available = this.availablePawnIdsFromPending(pending);
    if (!available.includes(pawnId)) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const pawnLabel =
      MorpionService.PawnChoices.find((pawn) => pawn.id === pawnId)?.label ??
      pawnId;
    let log = this.appendLog(
      state.log,
      `${players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`} a choisi le pion: ${pawnLabel}.`,
    );
    const metaAll =
      state.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : {};
    const meta = { ...metaAll } as MorpionMetadata;
    const nextBase: GameStateEntity = {
      ...state,
      log,
      metadata: {
        ...meta,
        glyphByPlayerId: {
          ...(meta.glyphByPlayerId ?? {}),
          [String(actorId)]: pawnId,
        },
      },
      pending: null,
    };
    const queued = queueConfiguredPawnSelection({
      state: nextBase,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: MorpionService.PawnChoices.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
      })),
      startPlayerId: actorId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'glyphByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label: String(choice.label ?? '').trim(),
        description: String(choice.description ?? '').trim(),
      }),
    });
    if (queued.pending) {
      return {
        ...queued,
        turn: {
          ...(queued.turn ?? { direction: 1 }),
          currentPlayerId: queued.pending.playerId ?? null,
          direction: 1,
          label: `Choix du pion - ${players.find((p) => p?.id === queued.pending?.playerId)?.username ?? `#${queued.pending?.playerId}`}`,
        },
      };
    }

    const startPlayerId = players[0]?.id ?? null;
    if (typeof startPlayerId === 'number' && Number.isFinite(startPlayerId)) {
      const startName =
        players.find((p) => p?.id === startPlayerId)?.username ??
        `#${startPlayerId}`;
      log = this.appendLog(log, starterTurnAnnouncement(startName));
    }
    return {
      ...queued,
      metadata: {
        ...meta,
        ...((queued.metadata as Record<string, unknown> | undefined) ?? {}),
      },
      pending: null,
      turn: {
        ...(queued.turn ?? { direction: 1 }),
        currentPlayerId: startPlayerId,
        direction: 1,
        label: startPlayerId
          ? `Tour de ${players.find((p) => p?.id === startPlayerId)?.username ?? `#${startPlayerId}`}`
          : undefined,
      },
      log,
    };
  }

  private asChoosePawnPending(
    pending: unknown,
  ): MorpionChoosePawnPending | null {
    if (!pending || typeof pending !== 'object') {
      return null;
    }

    const candidate = pending as {
      type?: unknown;
      playerId?: unknown;
      data?: unknown;
    };
    const type = String(candidate.type ?? '')
      .trim()
      .toLowerCase();
    if (type !== 'choose_pawn') {
      return null;
    }

    const playerId = Number(candidate.playerId);
    if (!Number.isFinite(playerId)) {
      return null;
    }

    const data =
      candidate.data && typeof candidate.data === 'object'
        ? (candidate.data as MorpionChoosePawnPending['data'])
        : undefined;

    return { type, playerId, data };
  }

  private availablePawnIdsFromPending(
    pending: MorpionChoosePawnPending,
  ): string[] {
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

    const matched = MorpionService.PawnChoices.find(
      (pawn) => pawn.id === normalized,
    );
    if (matched) {
      return matched.id;
    }

    return null;
  }
}






