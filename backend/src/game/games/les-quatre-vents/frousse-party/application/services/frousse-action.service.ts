import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { BoardEffectsPoliciesService } from '../../../../../application/features/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { continueSequentialPawnSelection } from '../../../../../application/helpers/sequential-pawn-selection.helper';
import { applyConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-selection.helper';
import { starterTurnAnnouncement } from '../../../../../application/helpers/game-log-text.helper';
import type {
  FrousseCard,
  FrousseMetadata,
  FrousseTile,
} from '../../model/frousse.types';
import { resolvePawnId } from '../../pawns.utils';
import {
  asFroussePendingRecord,
  asFrousseRecord,
  clampFrousse,
  describeFrousseCardEffect,
  describeFroussePawnPossessive,
  extractFrousseMoveDelta,
  extractFrousseSkipTurns,
  formatFrousseCardDrawLog,
  FrousseRuntimeMetadata,
  isFrousseTeleportToCase40,
  normalizeFrousseCardText,
  normalizeFrousseMeta,
  toFrousseText,
} from './frousse-action.utils';
import { applyFrousseCardEffect } from './frousse-card-effects.utils';

export class FrousseActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setupFlow: SetupFlowService,
    private readonly boardEffects: Pick<
      BoardEffectsPoliciesService,
      'createPlacementLog' | 'resolveLanding'
    >,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  private advanceTurnWithAnnouncement(state: GameStateEntity): GameStateEntity {
    return this.turns.advanceTurn(state);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(
      this.ensurePawnSelection(state),
      actions,
      (next, action) => {
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            choose_pawn: () => {
              next = this.handleChoosePawn(next, action);
              next = this.ensurePawnSelection(next);
              return next;
            },
            roll: () => {
              next = this.handleRoll(next);
              return next;
            },
            draw: () => {
              next = this.handleDraw(next);
              return next;
            },
            choose_target: () => {
              next = this.handleChooseTarget(next, action);
              return next;
            },
            swap_decline: () => {
              next = this.handleSwapDecline(next);
              return next;
            },
          },
          () => next,
        );
      },
    );
    return next;
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: this.setupFlow,
      core: this.core,
      pendingType: 'choose_pawn',
      metadataCatalogKey: 'pawns',
      playerPawnField: 'pawn',
      playerPawnLabelField: 'pawnLabel',
      logPrefix: '[Frousse Party] ',
    });
    return this.finalizeStarterAfterPawnSelection(applied?.state ?? state);
  }

  private ensurePawnSelection(state: GameStateEntity): GameStateEntity {
    if (state.pending) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const everyoneHasPawn = players.every((player) =>
      Boolean(resolvePawnId(player?.pawn)),
    );
    if (everyoneHasPawn) return state;
    const metaForPending = this.getMeta(state);
    const usedForPending = new Set(
      players
        .map((p) => resolvePawnId(p?.pawn))
        .filter((id): id is string => Boolean(id)),
    );
    const choicesForPending = (
      Array.isArray(metaForPending.pawns) ? metaForPending.pawns : []
    )
      .map((p) => ({
        id: toFrousseText(p?.id),
        label: toFrousseText(p?.name) || toFrousseText(p?.id),
        description: toFrousseText(p?.description),
      }))
      .filter((p) => p.id.length > 0 && !usedForPending.has(p.id));
    return continueSequentialPawnSelection({
      state,
      setupFlow: this.setupFlow,
      core: this.core,
      chooserPlayerId: players[0]?.id ?? null,
      players,
      isAssigned: (candidateId) => {
        const player = players.find((p) => p?.id === candidateId);
        return Boolean(resolvePawnId(player?.pawn));
      },
      pawns: choicesForPending,
      pawnDataMapper: (choice) => ({
        id: toFrousseText(choice.id),
        label: toFrousseText(choice.label),
        description: toFrousseText(choice.description),
      }),
      extraPendingData: { kind: 'choose_pawn' },
    });
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);

    // Saut de tour: si l'état courant indique un tour à passer, on consomme et on avance.
    const skipNow = meta.statuses?.skipTurn?.[currentId] ?? 0;
    if (skipNow > 0) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses?.skipTurn ?? {}),
            [currentId]: Math.max(0, skipNow - 1),
          },
        },
      };
      let next: GameStateEntity = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...meta },
      };
      const remaining = Math.max(0, skipNow - 1);
      const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} passe son tour${suffix}.`,
      );
      return this.advanceTurnWithAnnouncement(next);
    }

    // Blocages (tentatives de sortie).
    const blocked = meta.statuses?.blocked?.[currentId] ?? null;
    if (blocked) {
      const roll = this.roll(meta, currentId);
      meta = roll.meta;
      let next: GameStateEntity = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...meta },
        lastRoll: roll.value,
      };
      const rollLabel = this.formatRollLabel(roll);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} tente de se libérer : dé = "${rollLabel}".`,
      );
      const ok =
        blocked.kind === 'need_roll_one_of'
          ? blocked.allowed.includes(roll.value)
          : blocked.kind === 'need_roll_min'
            ? roll.value >= blocked.min
            : blocked.kind === 'need_roll_even'
              ? roll.value % 2 === 0
              : false;
      if (!ok) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, currentId)} reste bloqué.`,
        );
        return this.advanceTurnWithAnnouncement(next);
      }
      meta = this.getMeta(next);
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: { ...(meta.statuses.blocked ?? {}), [currentId]: null },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} se libère !`,
      );
      return this.advanceTurnWithAnnouncement(next);
    }

    const roll = this.roll(meta, currentId);
    meta = roll.meta;

    let move = roll.value;
    const cap = meta.statuses?.nextMoveCap?.[currentId] ?? 0;
    if (cap > 0) {
      move = Math.min(move, cap);
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [currentId]: 0 },
        },
      };
    }

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
      lastRoll: roll.value,
    };
    if (roll.rolls && roll.rolls.length >= 2) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} lance deux dés : "${roll.rolls[0]}" et "${roll.rolls[1]}" (garde "${roll.value}").`,
      );
    } else {
      const rollLabel = this.formatRollLabel(roll);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} lance le dé : "${rollLabel}".`,
      );
    }

    // Effet conditionnel: "Si vous faites un trois, reculez de 2 cases."
    if (meta.statuses?.nextRollIfThreeBackTwo?.[currentId] === true) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollIfThreeBackTwo: {
            ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
            [currentId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      if (roll.value === 3) {
        next = this.core.appendLog(next, 'Reculez de 2 cases.');
        next = this.move(next, currentId, -2);
      }
      meta = this.getMeta(next);
    }

    next = this.move(next, currentId, move);
    next = this.applyLanding(next, currentId);

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    // Relance immédiate (cartes bonus/farces).
    if (meta.keepTurnNow === true) {
      next = this.clearKeepTurnNow(next);
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} rejoue.`,
      );
    }

    return this.advanceTurnWithAnnouncement(next);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = asFroussePendingRecord(state.pending);
    if (
      !pending ||
      pending.type !== 'choose_target' ||
      pending.playerId !== currentId
    )
      return state;

    const targetPlayerId = Number(
      asFrousseRecord(action.payload).targetPlayerId,
    );
    if (!Number.isFinite(targetPlayerId)) return state;

    let meta = this.getMeta(state);
    const ctx = meta.pendingContext ?? null;
    if (!ctx || ctx.kind !== 'swap' || ctx.actorId !== currentId)
      return { ...state, pending: null };

    const actorPos = meta.positions?.[currentId] ?? 0;
    const targetPos = meta.positions?.[targetPlayerId] ?? 0;
    meta = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [currentId]: targetPos,
        [targetPlayerId]: actorPos,
      },
      pendingContext: null,
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} échange sa position avec ${resolvePlayerNameFromState(next, targetPlayerId)}.`,
    );
    return this.advanceTurnWithAnnouncement(next);
  }

  private handleSwapDecline(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;

    const pending = asFroussePendingRecord(state.pending);
    if (!pending || pending.type !== 'choose_target') return state;

    const currentId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    const ctx = meta.pendingContext ?? null;
    if (!ctx || ctx.kind !== 'swap' || ctx.actorId !== currentId) {
      return { ...state, pending: null };
    }

    meta = { ...meta, pendingContext: null };
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} refuse l'échange de position.`,
    );
    return this.advanceTurnWithAnnouncement(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = asFroussePendingRecord(state.pending);
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (!playerId) return state;

    const cleared: GameStateEntity = { ...state, pending: null };
    return this.applyDrawCard(cleared, playerId);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos] as FrousseTile | undefined;

    if (tile) {
      const labelRaw = toFrousseText(asFrousseRecord(tile).label);
      const typeLabel = tile.type === 'card' ? 'case symbole' : 'case neutre';
      const fallbackLabel = `case ${tile.n}. ${tile.title} (${typeLabel})`;
      const label = labelRaw || fallbackLabel;
      const casePrefix = new RegExp(`^case\\s+${tile.n}\\b[\\s.:,;-]*`, 'i');
      const normalizedLabel = label.replace(casePrefix, '').trim();
      const labelForParenthesis = normalizedLabel || label;
      const placement = this.boardEffects.createPlacementLog({
        playerLabel: resolvePlayerNameFromState(next, playerId),
        pawnLabel: describeFroussePawnPossessive(next, meta, playerId),
        position: Math.max(0, Number(tile.n ?? pos + 1) - 1),
        tileLabel: labelForParenthesis,
      });
      next = this.core.appendLog(next, placement);

      const landing = this.boardEffects.resolveLanding({
        position: pos,
        playerId,
        tile: {
          type: tile.type,
          description: toFrousseText(asFrousseRecord(tile).description),
        },
        drawPolicies: {
          card: {
            log: 'Piochez une carte.',
            pendingLabel: 'Piocher une carte (Espace).',
          },
        },
      });
      for (const line of landing.logs) {
        if (line.trim().length > 0) {
          next = this.core.appendLog(next, line);
        }
      }
    }

    if (pos === 49) {
      meta = { ...meta, winnerId: playerId };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} s'échappe du manoir !`,
      );
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (!tile) return next;
    if (tile.type !== 'card') return next;
    const pending = this.boardEffects.resolveLanding({
      position: pos,
      playerId,
      tile: {
        type: tile.type,
        description: null,
      },
      drawPolicies: {
        card: {
          log: 'Piochez une carte.',
          pendingLabel: 'Piocher une carte (Espace).',
        },
      },
    }).pending;
    if (!pending) return next;
    return { ...next, pending };
  }

  private applyDrawCard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;

    let ignored = false;

    // Ignore traps until next symbol (one draw).
    if (meta.statuses.ignoreTrapUntilNextDraw?.[playerId]) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreTrapUntilNextDraw: {
            ...(meta.statuses.ignoreTrapUntilNextDraw ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      if (/Piège/i.test(draw.card.category)) {
        ignored = true;
      }
    }

    // Ignore ghost/trap/prank.
    if (
      /Fantôme/i.test(draw.card.category) &&
      meta.statuses.ignoreNextGhost?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextGhost: {
            ...(meta.statuses.ignoreNextGhost ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      ignored = true;
    }
    if (
      /Farce/i.test(draw.card.category) &&
      meta.statuses.ignoreNextPrank?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextPrank: {
            ...(meta.statuses.ignoreNextPrank ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      ignored = true;
    }
    if (
      /Piège/i.test(draw.card.category) &&
      meta.statuses.ignoreNextTrap?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextTrap: {
            ...(meta.statuses.ignoreNextTrap ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      ignored = true;
    }

    const effectLabel = ignored
      ? 'Effet ignoré.'
      : describeFrousseCardEffect(draw.card);
    const cardText = normalizeFrousseCardText(draw.card.text);
    const withEffect = formatFrousseCardDrawLog(
      resolvePlayerNameFromState(next, playerId),
      cardText,
      effectLabel,
    );
    next = this.core.appendLog(next, withEffect);

    if (ignored) {
      return this.advanceTurnWithAnnouncement(next);
    }

    const applied = this.applyCard(next, playerId, draw.card);
    const appliedMeta = this.getMeta(applied);
    if (applied.pending) return applied;
    if (appliedMeta.keepTurnNow === true) {
      return this.clearKeepTurnNow(applied);
    }
    return this.advanceTurnWithAnnouncement(applied);
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: FrousseCard,
  ): GameStateEntity {
    return applyFrousseCardEffect({
      state,
      playerId,
      card,
      meta: this.getMeta(state),
      deps: {
        appendLog: (current, message) => this.core.appendLog(current, message),
        pickOne: (meta, values) => this.random.pickOne(meta, values),
        otherPlayers: (current, actorId) => this.otherPlayers(current, actorId),
        otherPlayerIds: (meta, me) => this.otherPlayerIds(meta, me),
        move: (current, actorId, delta) => this.move(current, actorId, delta),
        applyLanding: (current, actorId) => this.applyLanding(current, actorId),
        setPos: (current, actorId, pos) => this.setPos(current, actorId, pos),
      },
    });
  }

  private roll(
    meta: FrousseMetadata,
    playerId: number,
  ): {
    value: number;
    meta: FrousseMetadata;
    rolls?: number[];
    doubledFrom?: number;
    baseRoll: number;
    malusApplied: number;
    valueAfterMalus: number;
  } {
    let outMeta = meta;

    const keepLowest = outMeta.statuses.nextRollKeepLowest?.[playerId] === true;
    if (keepLowest) {
      const a = this.random.rollDice(outMeta, 6);
      outMeta = { ...outMeta, ...a.meta };
      const b = this.random.rollDice(outMeta, 6);
      outMeta = { ...outMeta, ...b.meta };
      const rolls = [a.roll, b.roll];
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollKeepLowest: {
            ...(outMeta.statuses.nextRollKeepLowest ?? {}),
            [playerId]: false,
          },
        },
      };
      const kept = Math.min(a.roll, b.roll);
      return {
        value: kept,
        meta: outMeta,
        rolls,
        baseRoll: kept,
        malusApplied: 0,
        valueAfterMalus: kept,
      };
    }

    const single = this.random.rollDice(outMeta, 6);
    outMeta = { ...outMeta, ...single.meta };
    const baseRoll = single.roll;
    let value = baseRoll;

    const malus = outMeta.statuses.nextRollMalus?.[playerId] ?? 0;
    let malusApplied = 0;
    if (malus !== 0) {
      malusApplied = malus;
      value = clampFrousse(value + malus, 1, 6);
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollMalus: {
            ...(outMeta.statuses.nextRollMalus ?? {}),
            [playerId]: 0,
          },
        },
      };
    }
    const valueAfterMalus = value;

    if (outMeta.statuses.nextRollDouble?.[playerId]) {
      const doubledFrom = value;
      value = value * 2;
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollDouble: {
            ...(outMeta.statuses.nextRollDouble ?? {}),
            [playerId]: false,
          },
        },
      };
      return {
        value,
        meta: outMeta,
        doubledFrom,
        baseRoll,
        malusApplied,
        valueAfterMalus,
      };
    }

    return { value, meta: outMeta, baseRoll, malusApplied, valueAfterMalus };
  }

  private formatRollLabel(roll: {
    value: number;
    doubledFrom?: number;
    baseRoll: number;
    malusApplied: number;
    valueAfterMalus: number;
  }): string {
    let label = `${roll.value}`;

    if (roll.malusApplied !== 0) {
      const amount = Math.abs(roll.malusApplied);
      const op = roll.malusApplied < 0 ? 'moins' : 'plus';
      label = `${roll.baseRoll} ${op} ${amount} = ${roll.valueAfterMalus}`;
    }

    if (roll.doubledFrom != null) {
      const beforeDouble =
        roll.malusApplied !== 0 ? label : `${roll.doubledFrom}`;
      label = `${beforeDouble} (doublé = ${roll.value})`;
    }

    return label;
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    let nextPos = pos + delta;
    if (nextPos < 0) {
      nextPos = 0;
    } else if (nextPos > 49) {
      nextPos = Math.max(0, 49 - (nextPos - 49));
    }
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: FrousseMetadata = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [playerId]: clampFrousse(pos, 0, 49),
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(meta: FrousseMetadata): {
    card: FrousseCard | null;
    meta: FrousseMetadata;
  } {
    const draw = this.deckPolicies.drawFromPile<FrousseCard, FrousseMetadata>({
      meta,
      pile: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
      discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    return {
      card: draw.card,
      meta: {
        ...draw.meta,
        decks: { cards: draw.pile, discard: draw.discard },
      },
    };
  }

  private otherPlayers(
    state: GameStateEntity,
    me: number,
  ): Array<{ id: number; username: string }> {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((p) => p?.id != null && p.id !== me)
      .map((p) => ({
        id: p.id,
        username: resolvePlayerNameFromState(state, p.id),
      }));
  }

  private otherPlayerIds(meta: FrousseMetadata, me: number): number[] {
    return Object.keys(meta.positions ?? {})
      .map(Number)
      .filter((id) => Number.isFinite(id) && id !== me);
  }

  private getMeta(state: GameStateEntity): FrousseRuntimeMetadata {
    return normalizeFrousseMeta(state.metadata);
  }

  private clearKeepTurnNow(state: GameStateEntity): GameStateEntity {
    const metadata = asFrousseRecord(state.metadata);
    if (!('keepTurnNow' in metadata)) return state;
    const nextMetadata = { ...metadata };
    delete nextMetadata.keepTurnNow;
    return { ...state, metadata: nextMetadata };
  }

  private finalizeStarterAfterPawnSelection(
    state: GameStateEntity,
  ): GameStateEntity {
    if (state.pending) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const everyoneHasPawn = players.every((p) => resolvePawnId(p?.pawn));
    if (!everyoneHasPawn) return state;

    const meta = this.getMeta(state);
    if (meta.starterChosenAfterPawnSelection === true) {
      return state;
    }

    const pick = this.random.nextInt(meta, players.length);
    const starterIndex = Math.max(0, Math.min(players.length - 1, pick.value));
    const starter = players[starterIndex] ?? players[0];
    const nextMeta = {
      ...meta,
      ...pick.meta,
      starterChosenAfterPawnSelection: true,
    };
    let next: GameStateEntity = {
      ...state,
      turnIndex: starterIndex,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starter?.id ?? null,
        direction: 1,
      },
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    if (typeof starter?.id === 'number') {
      next = this.core.appendLog(
        next,
        `[Frousse Party] Début de partie : ${resolvePlayerNameFromState(next, starter.id)} commence.`,
      );
      next = this.core.appendLog(
        next,
        starterTurnAnnouncement(resolvePlayerNameFromState(next, starter.id)),
      );
    }
    return next;
  }
}
