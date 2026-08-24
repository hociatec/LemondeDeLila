import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import type { CorridorMetadata } from '../../model/corridor.model';
import * as CorridorRulebook from '../../rulebook/rulebook';
import {
  applyActionPipeline,
  applyActionsSequentially,
  dispatchByActionType,
  harmonizeActionStateReturn,
  normalizeLowerActionType,
} from '../../../../../application/helpers/action-service.helper';
import { CorridorSetupService } from './corridor-setup.service';
import { applyConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-selection.helper';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../application/helpers/configured-pawn-setup.helper';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import {
  appendUniqueCorridorLogMessages,
  toCorridorCellRef,
  toCorridorColumnLetters,
} from './corridor-action.utils';

type CorridorActionMeta = {
  actorId?: number;
};

type CorridorChoosePawnPayload = {
  pawnId?: string | number;
  pawn?: string | number;
  id?: string | number;
};

type CorridorSetupLike = {
  resolvePawnChoice: (
    rawPawn: unknown,
    options: Array<Record<string, unknown>>,
  ) => Record<string, unknown> | null;
};

type CorridorCoreLike = {
  appendLog: (current: GameStateEntity, message: string) => GameStateEntity;
};

type CorridorRuntimeMetadata = CorridorMetadata &
  Record<string, unknown> & {
    winnerPlayerId?: number | null;
    winnerId?: number | null;
    finishedAt?: string;
    outcomesByPlayerId?: Record<string, unknown>;
  };

export class CorridorActionService {
  constructor(
    private readonly setup: CorridorSetupService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private appendUniqueLogMessages(
    state: GameStateEntity,
    messages: string[],
  ): GameStateEntity {
    return appendUniqueCorridorLogMessages(state, messages);
  }

  private toCellRef(pos: { x: number; y: number }, size: number): string {
    return toCorridorCellRef(pos, size);
  }

  private static toColumnLetters(column: number): string {
    return toCorridorColumnLetters(column);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(
      harmonizeActionStateReturn(state),
      actions,
      (next, action) => this.applyOne(harmonizeActionStateReturn(next), action),
    );
  }

  private applyOne(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const actionMeta = (action.meta ?? {}) as CorridorActionMeta;
    const actorId =
      typeof actionMeta.actorId === 'number'
        ? actionMeta.actorId
        : (state.turn?.currentPlayerId ?? null);
    const type = normalizeLowerActionType(action);
    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn' && type !== 'choose_pawn') {
      return state;
    }
    if (
      (state.metadata as CorridorMetadata | undefined)?.setupStep ===
      'setup_config'
    ) {
      if (type !== 'corridor_set_config') {
        return state;
      }
    }
    return dispatchByActionType(
      type,
      {
        corridor_set_config: () => this.applySetConfig(state, action, actorId),
        choose_pawn: () => this.applyChoosePawn(state, action, actorId),
        corridor_move: () => this.applyMove(state, action, actorId),
        corridor_place_wall: () => this.applyWall(state, action, actorId),
      },
      () => state,
    );
  }

  private applySetConfig(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    if (actorId == null) return state;
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    if ((meta.setupStep ?? '') !== 'setup_config') {
      return state;
    }
    if (meta.ownerPlayerId !== actorId) {
      return state;
    }

    const payload = action.payload ?? {};
    const wallsPerPlayer = this.setup.resolveWallsPerPlayer(
      payload.wallsPerPlayer ?? payload.value ?? null,
    );
    const next = this.setup.applySetupConfig(state, wallsPerPlayer);
    return this.appendUniqueLogMessages(next, [
      `${(state.players ?? []).find((p) => p?.id === actorId)?.username ?? `#${actorId}`} fixe ${wallsPerPlayer} mur(s) par joueur.`,
    ]);
  }

  private applyChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    if (actorId == null) return state;
    if (
      String(state.pending?.type ?? '')
        .trim()
        .toLowerCase() !== 'choose_pawn'
    ) {
      return state;
    }
    const pendingPlayerId = state.pending?.playerId ?? null;
    if (pendingPlayerId !== actorId) {
      return state;
    }

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const allPawns = Array.isArray(meta?.pawns) ? meta.pawns : [];
    const coreLike: CorridorCoreLike = {
      appendLog: (current: GameStateEntity, message: string) =>
        this.appendUniqueLogMessages(current, [message]),
    };
    const setupLike: CorridorSetupLike = {
      resolvePawnChoice: (
        _rawPawn: unknown,
        options: Array<Record<string, unknown>>,
      ) => {
        const payload = (action.payload ?? {}) as CorridorChoosePawnPayload;
        const raw = String(
          payload.pawnId ?? payload.pawn ?? payload.id ?? '',
        ).trim();
        return (
          options.find((entry) => {
            const entryId =
              typeof entry?.id === 'string'
                ? entry.id.trim()
                : typeof entry?.id === 'number'
                  ? String(entry.id)
                  : '';
            return entryId === raw;
          }) ?? null
        );
      },
    };
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: setupLike,
      core: coreLike,
      pendingType: 'choose_pawn',
      metadataCatalogKey: 'pawns',
      metadataAssignmentKey: 'pawnByPlayerId',
      logLabelResolver: (choice) => String(choice.label ?? choice.id).trim(),
    });
    if (!applied) return state;

    const next = assignConfiguredBotPawns({
      state: applied.state,
      core: coreLike,
      catalog: allPawns.map((pawn) => ({
        id: String(pawn.id ?? '').trim(),
        label: String(pawn.label ?? '').trim(),
        description: String(pawn.description ?? '').trim(),
      })),
      metadataAssignmentKey: 'pawnByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      logLabelResolver: (choice) => String(choice.label ?? choice.id).trim(),
    });

    const starterId =
      typeof meta.setupStarterId === 'number'
        ? meta.setupStarterId
        : (state.players?.[0]?.id ?? actorId);
    const starter =
      (state.players ?? []).find((p) => p?.id === starterId) ?? null;
    const queued = queueConfiguredPawnSelection({
      state: next,
      core: coreLike,
      setupFlow: this.setupFlow,
      catalog: allPawns.map((pawn) => ({
        id: String(pawn.id ?? '').trim(),
        label: String(pawn.label ?? '').trim(),
        description: String(pawn.description ?? '').trim(),
      })),
      startPlayerId: actorId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'pawnByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label: `${String(choice.label ?? '').trim()} - ${String(choice.description ?? '').trim()}`,
        description: String(choice.description ?? '').trim(),
      }),
    });
    const nextPendingPlayer = queued.pending?.playerId ?? null;
    return {
      ...queued,
      turn: {
        ...(queued.turn ?? { direction: 1 }),
        currentPlayerId: nextPendingPlayer ?? starterId,
        direction: 1,
        label:
          nextPendingPlayer != null
            ? 'Choix du pion'
            : `Tour de ${starter?.username ?? 'joueur'}`,
      },
    };
  }

  private applyMove(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return applyActionPipeline(state, action, {
      guard: () => actorId != null,
      validate: (current, currentAction) =>
        CorridorRulebook.validateMoveAction(current, currentAction, actorId),
      transition: (current, _currentAction, validatedMove) => {
        const { to, actorId: validatedActor } = validatedMove;
        const meta = (current.metadata ?? {}) as CorridorMetadata;
        const from = CorridorRulebook.getPawnPos(meta, validatedActor);
        const size = Number(meta?.size ?? 0) || 9;

        const nextMeta: CorridorMetadata = {
          ...meta,
          pawnsByPlayerId: {
            ...(meta.pawnsByPlayerId ?? {}),
            [String(validatedActor)]: { x: to.x, y: to.y },
          },
        };

        return {
          actorId: validatedActor,
          metadata: nextMeta,
          moveMessage: `se deplace de ${this.toCellRef(from, size)} a ${this.toCellRef(to, size)}`,
          maybeWinnerPos: to,
        };
      },
      effects: (current, _currentAction, _validatedMove, transitioned) =>
        this.advanceTurnAndMaybeFinish(
          current,
          transitioned.actorId,
          transitioned.metadata,
          {
            moveMessage: transitioned.moveMessage,
            maybeWinnerPos: transitioned.maybeWinnerPos,
          },
        ),
    });
  }

  private applyWall(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return applyActionPipeline(state, action, {
      guard: () => actorId != null,
      validate: (current, currentAction) =>
        CorridorRulebook.validatePlaceWallAction(
          current,
          currentAction,
          actorId,
        ),
      transition: (current, _currentAction, validatedWall) => {
        const { wall, actorId: validatedActor } = validatedWall;
        const meta = (current.metadata ?? {}) as CorridorMetadata;
        const size = Number(meta?.size ?? 0) || 9;
        const remaining =
          (meta?.wallsRemainingByPlayerId ?? {})[String(validatedActor)] ?? 0;

        const nextMeta: CorridorMetadata = {
          ...CorridorRulebook.applyWall(meta, wall),
          wallsRemainingByPlayerId: {
            ...(meta?.wallsRemainingByPlayerId ?? {}),
            [String(validatedActor)]: Math.max(0, remaining - 1),
          },
        };

        const at = this.toCellRef({ x: wall.x, y: wall.y }, size);
        const orientation = wall.o === 'h' ? 'horizontal' : 'vertical';

        return {
          actorId: validatedActor,
          metadata: nextMeta,
          moveMessage: `place un mur ${orientation} en ${at}`,
          maybeWinnerPos: null,
        };
      },
      effects: (current, _currentAction, _validatedWall, transitioned) =>
        this.advanceTurnAndMaybeFinish(
          current,
          transitioned.actorId,
          transitioned.metadata,
          {
            moveMessage: transitioned.moveMessage,
            maybeWinnerPos: transitioned.maybeWinnerPos,
          },
        ),
    });
  }

  private advanceTurnAndMaybeFinish(
    state: GameStateEntity,
    actorId: number,
    nextMeta: CorridorMetadata,
    options: { moveMessage: string; maybeWinnerPos: unknown },
  ): GameStateEntity {
    const players = state.players ?? [];
    const actor = players.find((p) => p?.id === actorId);
    const other = players.find((p) => p?.id !== actorId);
    const nextPlayerId = other?.id ?? actorId;

    const won =
      options.maybeWinnerPos != null
        ? CorridorRulebook.isWinningPos(state, actorId, options.maybeWinnerPos)
        : false;

    const safeMeta: CorridorRuntimeMetadata = {
      ...nextMeta,
    };
    if (won) {
      safeMeta.winnerPlayerId = actorId;
      safeMeta.winnerId = actorId;
    } else {
      safeMeta.winnerPlayerId = null;
      safeMeta.winnerId = null;
      delete safeMeta.finishedAt;
      delete safeMeta.outcomesByPlayerId;
    }

    const status = won ? 'finished' : state.status;

    const actorName = actor?.username ?? `#${actorId}`;
    const moveMsg = `${actorName} ${options.moveMessage}.`;
    const winMsg = won ? `Victoire de ${actorName}.` : null;
    const nextWithLogs = this.appendUniqueLogMessages(state, [
      moveMsg,
      ...(winMsg ? [winMsg] : []),
    ]);

    return {
      ...nextWithLogs,
      status,
      metadata: safeMeta,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: won
        ? {
            ...(nextWithLogs.turn ?? { currentPlayerId: null, direction: 1 }),
            currentPlayerId: null,
          }
        : {
            ...(nextWithLogs.turn ?? {
              currentPlayerId: nextPlayerId,
              direction: 1,
            }),
            currentPlayerId: nextPlayerId,
            label: `Tour de ${other?.username ?? 'joueur'}`,
          },
    };
  }
}



