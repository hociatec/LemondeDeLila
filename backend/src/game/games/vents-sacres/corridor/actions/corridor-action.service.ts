import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';
import {
  applyActionPipeline,
  applyActionsSequentially,
  dispatchByActionType,
  harmonizeActionStateReturn,
  normalizeLowerActionType,
} from '../../../../actions/action-service.helper';
import { CorridorSetupService } from '../setup/corridor-setup.service';
import { applyConfiguredPawnSelection } from '../../../../core/helpers/configured-pawn-selection.helper';

@Injectable()
export class CorridorActionService {
  constructor(private readonly setup: CorridorSetupService) {}

  private appendUniqueLogMessages(
    state: GameStateEntity,
    messages: string[],
  ): GameStateEntity {
    let out = state;
    for (const raw of messages) {
      const message = String(raw ?? '').trim();
      if (!message) continue;
      const last = out.log?.[out.log.length - 1]?.message;
      if (String(last ?? '').trim() === message) continue;
      out = {
        ...out,
        log: [...(out.log ?? []), { message, timestamp: new Date().toISOString() }],
      };
    }
    return out;
  }

  private toCellRef(pos: { x: number; y: number }, size: number): string {
    const col = CorridorActionService.toColumnLetters((pos?.x ?? 0) + 1);
    const row = Math.max(1, size - (pos?.y ?? 0));
    return `${col}${row}`.toLowerCase();
  }

  private static toColumnLetters(column: number): string {
    let n = Math.max(1, Math.floor(Number(column) || 1));
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return out;
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

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : (state.turn?.currentPlayerId ?? null);
    const type = normalizeLowerActionType(action);
    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn' && type !== 'choose_pawn') {
      return state;
    }
    if ((state.metadata as CorridorMetadata | undefined)?.setupStep === 'setup_config') {
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

    const payload = (action.payload ?? {}) as Record<string, unknown>;
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
    if (String(state.pending?.type ?? '').trim().toLowerCase() !== 'choose_pawn') {
      return state;
    }
    const pendingPlayerId = state.pending?.playerId ?? null;
    if (pendingPlayerId !== actorId) {
      return state;
    }

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const allPawns = Array.isArray(meta?.pawns) ? meta.pawns : [];
    const coreLike = {
      appendLog: (current: GameStateEntity, message: string) =>
        this.appendUniqueLogMessages(current, [message]),
    } as any;
    const setupLike = {
      resolvePawnChoice: (_rawPawn: unknown, options: Array<Record<string, unknown>>) => {
        const raw = String(
          (action.payload as any)?.pawnId ??
            (action.payload as any)?.pawn ??
            (action.payload as any)?.id ??
            '',
        ).trim();
        return (
          options.find((entry) => String(entry?.id ?? '').trim() === raw) ?? null
        );
      },
    } as any;
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

    const appliedMeta = (applied.state.metadata ?? {}) as CorridorMetadata;
    const withBotsAssigned = this.autoAssignBotPawns(
      state.players ?? [],
      allPawns,
      { ...(appliedMeta.pawnByPlayerId ?? {}) },
    );
    let next: GameStateEntity = {
      ...applied.state,
      metadata: {
        ...(applied.state.metadata ?? {}),
        ...appliedMeta,
        pawnByPlayerId: withBotsAssigned,
      },
    };

    const starterId =
      typeof meta.setupStarterId === 'number'
        ? meta.setupStarterId
        : (state.players?.[0]?.id ?? actorId);
    const starter = (state.players ?? []).find((p) => p?.id === starterId) ?? null;
    const nextPendingPlayer = (state.players ?? []).find(
      (p) => p?.isBot !== true && !withBotsAssigned[String(p.id)],
    )?.id;
    const nextTurnPlayerId = nextPendingPlayer ?? starterId;
    return {
      ...next,
      pending:
        nextPendingPlayer != null
          ? {
              type: 'choose_pawn',
              label: 'Votre pion.',
              playerId: nextPendingPlayer,
              blocking: true,
              data: {
                pawns: allPawns
                  .filter((p) => !Object.values(withBotsAssigned).includes(String(p.id)))
                  .map((p) => ({
                    id: p.id,
                    label: `${p.label} - ${String(p.description ?? '').trim()}`,
                    description: p.description,
                  })),
              },
            }
          : null,
      turn: {
        ...(next.turn ?? { direction: 1 }),
        currentPlayerId: nextTurnPlayerId,
        direction: 1,
        label:
          nextPendingPlayer != null
            ? 'Choix du pion'
            : `Tour de ${starter?.username ?? 'joueur'}`,
      },
    };
  }

  private autoAssignBotPawns(
    players: Array<{ id: number; isBot?: boolean }>,
    pawns: Array<{ id: string }>,
    pawnByPlayerId: Record<string, string>,
  ): Record<string, string> {
    const out = { ...pawnByPlayerId };
    const used = new Set(Object.values(out));
    for (const bot of players.filter((p) => p?.isBot === true)) {
      if (out[String(bot.id)]) continue;
      const pick = pawns.find((p) => !used.has(String(p.id)));
      if (!pick) break;
      out[String(bot.id)] = String(pick.id);
      used.add(String(pick.id));
    }
    return out;
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
    options: { moveMessage: string; maybeWinnerPos: any },
  ): GameStateEntity {
    const players = state.players ?? [];
    const actor = players.find((p) => p?.id === actorId);
    const other = players.find((p) => p?.id !== actorId);
    const nextPlayerId = other?.id ?? actorId;

    const won =
      options.maybeWinnerPos != null
        ? CorridorRulebook.isWinningPos(state, actorId, options.maybeWinnerPos)
        : false;

    const safeMeta: CorridorMetadata & Record<string, unknown> = {
      ...(nextMeta as any),
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
      metadata: safeMeta as any,
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
