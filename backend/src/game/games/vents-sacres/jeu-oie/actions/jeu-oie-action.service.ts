import { Injectable, Optional } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { continueSequentialPawnSelection } from '../../../../core/helpers/sequential-pawn-selection.helper';
import { applyConfiguredPawnSelection } from '../../../../core/helpers/configured-pawn-selection.helper';
import type { JeuOieMetadata, JeuOieTile } from '../model/jeu-oie-state.entity';

import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
@Injectable()
export class JeuOieActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setupFlow: SetupFlowService,
    @Optional() private readonly turnPolicies?: TurnPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(
      this.ensurePawnSelectionPrompt(state),
      actions,
      (current, action) => {
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            choose_pawn: () =>
              this.ensurePawnSelectionPrompt(
                this.handleChoosePawn(current, action),
              ),
            roll: () => this.handleRoll(current),
          },
          () => current,
        );
      },
    );
    return this.ensurePawnSelectionPrompt(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: this.setupFlow,
      core: this.core,
      pendingType: 'choose_pawn',
      metadataCatalogKey: 'pawns',
      metadataAssignmentKey: 'pawnByPlayerId',
      choiceCatalogFallback: (options) =>
        options.map((p) => ({
          id: String(p?.id ?? '').trim(),
          label: String(p?.label ?? '').trim(),
          feminine: Boolean(p?.feminine),
        })),
    });
    if (!applied) return state;
    const { playerId } = applied;
    let next = applied.state;

    const playersForPending = Array.isArray(next.players) ? next.players : [];
    const metaForPending = this.getMeta(next);
    const pawnByPlayerIdForPending = metaForPending.pawnByPlayerId ?? {};
    const allPawnsForPending = Array.isArray(metaForPending.pawns)
      ? metaForPending.pawns
      : [];
    const usedForPending = new Set(
      Object.values(pawnByPlayerIdForPending).filter(
        (v) => typeof v === 'string',
      ),
    );
    const choicesForPending = allPawnsForPending
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
        feminine: Boolean(p?.feminine),
      }))
      .filter((p) => p.id.length > 0 && !usedForPending.has(p.id));
    const players = Array.isArray(next.players) ? next.players : [];
    let started = continueSequentialPawnSelection({
      state: next,
      setupFlow: this.setupFlow,
      chooserPlayerId: playerId,
      players: playersForPending,
      isAssigned: (candidateId) => Boolean(pawnByPlayerIdForPending[candidateId]),
      pawns: choicesForPending,
      pawnDataMapper: (p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
        feminine: Boolean(p?.feminine),
      }),
      starterId:
        typeof this.getMeta(next).setupStarterId === 'number'
          ? this.getMeta(next).setupStarterId
          : (players[0]?.id ?? null),
      onPending: (withPending) => this.ensurePawnSelectionPrompt(withPending),
    });
    if (started.pending) {
      return started;
    }

    const starterName = resolvePlayerNameFromState(
      started,
      started.turn?.currentPlayerId ?? 0,
    );
    started = this.core.appendLog(
      started,
      `D\u00e9but de partie : ${starterName} commence.`,
    );
    return this.getTurnPolicies().appendTurnAnnouncement(
      started,
      started.turn?.currentPlayerId ?? null,
      (s, id) => resolvePlayerNameFromState(s, id),
    );
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    const inWell = Boolean(meta.statuses?.well?.[currentId]);
    const rng = this.random.rollDice(meta as any, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(state, currentId)} lance le dé : "${roll}".`,
    );

    if (inWell) {
      if (roll !== 1) {
        const logged = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, currentId)} reste bloqué dans le puits.`,
        );
        return this.turns.advanceTurn(logged, {
          playerNameResolver: (s, id) => resolvePlayerNameFromState(s, id),
        });
      }
      const metaAfter = this.getMeta(next);
      const well = { ...(metaAfter.statuses?.well ?? {}) };
      delete well[currentId];
      next = {
        ...next,
        metadata: {
          ...(next.metadata ?? {}),
          ...metaAfter,
          statuses: { ...(metaAfter.statuses ?? {}), well },
        },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} sort du puits.`,
      );
    }

    const currentPos = meta.positions?.[currentId] ?? 1;
    const moved = this.move(currentPos, roll);
    next = this.applyLanding(next, currentId, moved, roll);

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      return { ...next, status: 'finished' };
    }

    return this.turns.advanceTurn(next, {
      playerNameResolver: (s, id) => resolvePlayerNameFromState(s, id),
    });
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
    roll: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: JeuOieTile | undefined = tiles[position];

    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: position },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const label = tile?.label ?? `Case ${position}`;
    const compactLabel = this.compactTileLabel(label, position);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${this.pawnPossessiveLabel(next, playerId)} en case ${position} (${compactLabel}).`,
    );

    if (!tile) return next;

    if (tile.description && String(tile.description).trim()) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} a gagné !`,
      );
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'bridge') {
      const jumpTo = 12;
      next = this.core.appendLog(
        next,
        `Pont : avance directement à la case ${jumpTo}.`,
      );
      return this.applyLanding(next, playerId, jumpTo, roll);
    }

    if (tile.type === 'death') {
      next = this.core.appendLog(next, 'Mort : retour au départ.');
      return this.applyLanding(next, playerId, tile.backTo, roll);
    }

    if (tile.type === 'labyrinth') {
      next = this.core.appendLog(
        next,
        `Labyrinthe : retour à la case ${tile.backTo}.`,
      );
      return this.applyLanding(next, playerId, tile.backTo, roll);
    }

    if (tile.type === 'inn' || tile.type === 'prison') {
      const turns = tile.skipTurns ?? 1;
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} perd ${turns} tour(s).`,
      );
      meta = this.getMeta(next);
      const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
      const statuses = meta.statuses ?? { skipTurn: {} };
      const skipTurn = {
        ...(statuses.skipTurn ?? {}),
        [playerId]: currentSkip + turns,
      };
      meta = { ...meta, statuses: { ...statuses, skipTurn } };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'magic_die') {
      const rng = this.random.rollDice(this.getMeta(next) as any, 6);
      const magicRoll = rng.roll;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...rng.meta },
        lastRoll: magicRoll,
      };
      next = this.core.appendLog(
        next,
        `Dé magique : ${resolvePlayerNameFromState(next, playerId)} lance "${magicRoll}".`,
      );
      const delta = magicRoll <= 3 ? magicRoll : -magicRoll;
      const moved = this.move(position, delta);
      next = this.core.appendLog(
        next,
        magicRoll <= 3
          ? `Dé magique : avance de ${magicRoll} case(s).`
          : `Dé magique : recule de ${magicRoll} case(s).`,
      );
      return this.applyLanding(next, playerId, moved, magicRoll);
    }

    if (tile.type === 'well') {
      const metaNow = this.getMeta(next);
      const well = { ...(metaNow.statuses?.well ?? {}) };
      well[playerId] = true;
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} est bloqué dans le puits (il faut faire 1 pour sortir).`,
      );
      return {
        ...next,
        metadata: {
          ...(next.metadata ?? {}),
          ...metaNow,
          statuses: { ...(metaNow.statuses ?? {}), well },
        },
      };
    }

    if (tile.type === 'goose') {
      next = this.core.appendLog(
        next,
        `Oie : avance à nouveau de ${roll} case(s).`,
      );
      const moved = this.move(position, roll);
      return this.applyLanding(next, playerId, moved, roll);
    }

    return next;
  }

  private move(currentPos: number, roll: number): number {
    const target = currentPos + roll;
    if (target < 0) return 0;
    if (target === 63) return 63;
    if (target < 63) return target;
    const overshoot = target - 63;
    return 63 - overshoot;
  }

  private getMeta(state: GameStateEntity): JeuOieMetadata {
    return (state.metadata ?? {}) as any as JeuOieMetadata;
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p: any) => String(p?.id ?? '').trim() === pawnId)
      : null;
    const label = String((pawn as any)?.label ?? '').trim();
    if (label) return label;
    return 'pion';
  }

  private pawnPossessiveLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p: any) => String(p?.id ?? '').trim() === pawnId)
      : null;
    const label = this.pawnLabel(state, id);
    const feminine = Boolean((pawn as any)?.feminine);
    const possessive = feminine ? 'sa' : 'son';
    return `"${possessive} ${this.lowercaseFirst(label)}"`;
  }

  private lowercaseFirst(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) return text;
    if (text.length === 1) return text.toLowerCase();
    return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  private compactTileLabel(label: string, position: number): string {
    const raw = String(label ?? '').trim();
    const withPrefix = new RegExp(`^case\\s+${position}\\s*-\\s*`, 'i');
    const stripped = raw.replace(withPrefix, '').trim();
    return stripped || raw || `Case ${position}`;
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta = this.getMeta(state);
    const isAssigned = (playerId: number): boolean =>
      Boolean(meta.pawnByPlayerId?.[playerId]);

    const missingPlayers = players.filter((player) => !isAssigned(player.id));
    if (!missingPlayers.length) {
      return state.pending?.type === 'choose_pawn'
        ? { ...state, pending: null }
        : state;
    }

    if (state.pending?.type === 'choose_pawn') {
      const pendingPlayerId = Number(state.pending.playerId);
      if (Number.isFinite(pendingPlayerId) && !isAssigned(pendingPlayerId)) {
        return state;
      }
    }

    const usedPawnIds = new Set(
      Object.values(meta.pawnByPlayerId ?? {}).filter(
        (pawnId): pawnId is string => typeof pawnId === 'string',
      ),
    );
    const availablePawns = (Array.isArray(meta.pawns) ? meta.pawns : [])
      .map((pawn: any) => ({
        id: String(pawn?.id ?? '').trim(),
        label: String(pawn?.label ?? '').trim(),
        feminine: Boolean(pawn?.feminine),
      }))
      .filter((pawn) => pawn.id.length > 0 && !usedPawnIds.has(pawn.id));
    const fallbackPawns = (Array.isArray(meta.pawns) ? meta.pawns : [])
      .map((pawn: any) => ({
        id: String(pawn?.id ?? '').trim(),
        label: String(pawn?.label ?? '').trim(),
        feminine: Boolean(pawn?.feminine),
      }))
      .filter((pawn) => pawn.id.length > 0);
    const pawns = availablePawns.length > 0 ? availablePawns : fallbackPawns;
    if (!pawns.length) return state;

    return continueSequentialPawnSelection({
      state,
      setupFlow: this.setupFlow,
      chooserPlayerId:
        typeof state.turn?.currentPlayerId === 'number'
          ? state.turn.currentPlayerId
          : (players[0]?.id ?? null),
      players,
      isAssigned,
      pawns,
      pawnDataMapper: (choice: any) => ({
        id: String(choice?.id ?? '').trim(),
        label: String(choice?.label ?? '').trim(),
        feminine: Boolean(choice?.feminine),
      }),
      onStarted: () => ({ ...state, pending: null }),
    });
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }
}
