import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import {
  clearPendingState,
  createPendingState,
} from '../../../../modules/pending-action/services/pending-action.service';
import { continueSequentialPawnSelection } from '../../../../core/helpers/sequential-pawn-selection.helper';
import {
  applyConfiguredPawnSelection,
} from '../../../../core/helpers/configured-pawn-selection.helper';
import { assignConfiguredBotPawns } from '../../../../core/helpers/configured-pawn-setup.helper';
import type {
  GaloponsCard,
  GaloponsCardEffect,
  GaloponsMetadata,
  GaloponsPawn,
  GaloponsTile,
} from '../model/galopons.types';

type GaloponsChooseTargetContext = {
  kind: 'pair_advance' | 'give_apple' | 'help_advance';
  actorId: number;
  replayAfter?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asPartialMeta(value: unknown): Partial<GaloponsMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<GaloponsMetadata>)
    : {};
}

@Injectable()
export class GaloponsActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const seededState = this.needsPawnSelection(state)
      ? this.ensurePawnSelection(state)
      : state;
    const next = applyActionsSequentially(
      seededState,
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
          },
          () => next,
        );
      },
    );
    return next;
  }

  private needsPawnSelection(state: GameStateEntity): boolean {
    const pendingType = toText(asRecord(state.pending).type);
    if (pendingType === 'choose_pawn') {
      return true;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      return false;
    }

    const meta = this.getMeta(state);
    return players.some((player) => {
      const playerId = Number(player?.id);
      if (!Number.isFinite(playerId)) {
        return false;
      }

      const row = asRecord(player);
      const assignedPawn =
        toText(meta.pawnByPlayerId?.[playerId]) || toText(row.pawn);
      return assignedPawn.length === 0;
    });
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
      metadataAssignmentKey: 'pawnByPlayerId',
      playerPawnField: 'pawn',
      playerPawnLabelField: 'pawnLabel',
      playerPawnLabelResolver: (choice, currentState) =>
        this.resolvePawnName(
          this.getMeta(currentState).pawns,
          toText(choice.id),
        ) ||
        this.normalizePawnChoiceLabel(toText(choice.label)) ||
        toText(choice.id) ||
        'pion',
      logLabelResolver: (choice, currentState) =>
        this.resolvePawnName(
          this.getMeta(currentState).pawns,
          toText(choice.id),
        ) ||
        this.normalizePawnChoiceLabel(toText(choice.label)) ||
        toText(choice.id) ||
        'pion',
    });
    return applied?.state ?? state;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);

    // Paiement des dettes (\"il vous en rendra une plus tard\") : si possible, le joueur rend 1 pomme avant de jouer.
    const iou = meta.ious?.[currentId] ?? null;
    if (iou && typeof iou === 'object') {
      const creditors = Object.keys(iou)
        .map(Number)
        .filter((id) => Number.isFinite(id) && (iou[id] ?? 0) > 0);
      if (creditors.length && (meta.apples?.[currentId] ?? 0) > 0) {
        const creditorId = creditors[0];
        const nextApples = { ...(meta.apples ?? {}) };
        nextApples[currentId] = (nextApples[currentId] ?? 0) - 1;
        nextApples[creditorId] = (nextApples[creditorId] ?? 0) + 1;

        const nextIous = { ...(meta.ious ?? {}) };
        const mine = { ...(nextIous[currentId] ?? {}) };
        mine[creditorId] = Math.max(0, (mine[creditorId] ?? 0) - 1);
        nextIous[currentId] = mine;

        meta = { ...meta, apples: nextApples, ious: nextIous };
      }
    }

    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    meta = { ...meta, ...asPartialMeta(rng.meta) };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} lance le dé : "${roll}".`,
    );

    next = this.move(next, currentId, roll);
    next = this.applyLanding(next, currentId, currentId);
    return this.resolveTurnEnd(next, currentId);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending;
    const pendingRow = asRecord(pending);
    if (
      !pending ||
      pendingRow.type !== 'choose_target' ||
      Number(pendingRow.playerId ?? null) !== currentId
    )
      return state;
    const payload = asRecord(action.payload);
    const targetPlayerId = Number(payload.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) return state;
    const turnInitiatorPlayerId = this.resolveInitiatorPlayerId(
      state,
      pending,
      currentId,
    );

    let meta = this.getMeta(state);
    const ctx = this.getChooseTargetContext(pending);
    if (!ctx || ctx.actorId !== currentId) return clearPendingState(state);

    let next: GameStateEntity = {
      ...clearPendingState(state),
      metadata: { ...(state.metadata ?? {}), ...meta },
    };

    if (ctx.kind === 'pair_advance') {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} et ${resolvePlayerNameFromState(next, targetPlayerId)} avancent d'une case.`,
      );
      next = this.move(next, currentId, 1);
      next = this.move(next, targetPlayerId, 1);
      next = this.applyLanding(next, currentId, turnInitiatorPlayerId);
      if (!next.pending) {
        next = this.applyLanding(next, targetPlayerId, turnInitiatorPlayerId);
      }
      return this.resolveTurnEnd(
        next,
        currentId,
        ctx.replayAfter === true,
        turnInitiatorPlayerId,
      );
    }

    if (ctx.kind === 'give_apple') {
      const a = meta.apples?.[currentId] ?? 0;
      if (a <= 0) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, currentId)} n'a pas de pomme à donner.`,
        );
        if (ctx.replayAfter)
          return this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, currentId)} rejoue.`,
          );
        return this.turns.advanceTurn(
          this.setCurrentTurnPlayer(next, turnInitiatorPlayerId),
        );
      }
      meta = this.getMeta(next);
      const nextApples = {
        ...meta.apples,
        [currentId]: a - 1,
        [targetPlayerId]: (meta.apples?.[targetPlayerId] ?? 0) + 1,
      };
      const nextIous = { ...(meta.ious ?? {}) };
      const forTarget = { ...(nextIous[targetPlayerId] ?? {}) };
      forTarget[currentId] = (forTarget[currentId] ?? 0) + 1;
      nextIous[targetPlayerId] = forTarget;
      meta = { ...meta, apples: nextApples, ious: nextIous };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} donne une pomme à ${resolvePlayerNameFromState(next, targetPlayerId)}.`,
      );
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, targetPlayerId)} devra rendre une pomme plus tard.`,
      );
      return this.resolveTurnEnd(
        next,
        currentId,
        ctx.replayAfter === true,
        turnInitiatorPlayerId,
      );
    }

    if (ctx.kind === 'help_advance') {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} aide ${resolvePlayerNameFromState(next, targetPlayerId)} : +2 cases.`,
      );
      next = this.move(next, targetPlayerId, 2);
      next = this.applyLanding(next, targetPlayerId, turnInitiatorPlayerId);
      meta = this.getMeta(next);
      const targetApples = meta.apples?.[targetPlayerId] ?? 0;
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [currentId]:
            (meta.apples?.[currentId] ?? 0) + (targetApples > 0 ? 1 : 0),
          [targetPlayerId]: Math.max(0, targetApples - 1),
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next =
        targetApples > 0
          ? this.core.appendLog(
              next,
              `${resolvePlayerNameFromState(next, currentId)} reçoit une pomme en remerciement.`,
            )
          : this.core.appendLog(
              next,
              `${resolvePlayerNameFromState(next, targetPlayerId)} n'a pas de pomme à offrir en remerciement.`,
            );
      return this.resolveTurnEnd(
        next,
        currentId,
        ctx.replayAfter === true,
        turnInitiatorPlayerId,
      );
    }

    return this.turns.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending;
    const pendingRow = asRecord(pending);
    if (!pending || pendingRow.type !== 'draw') return state;

    const playerId =
      typeof pendingRow.playerId === 'number'
        ? pendingRow.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (!playerId) return state;
    const turnInitiatorPlayerId = this.resolveInitiatorPlayerId(
      state,
      pending,
      playerId,
    );

    const cleared = clearPendingState(state);
    const next = this.applyDrawCard(
      this.setCurrentTurnPlayer(cleared, playerId),
      playerId,
      turnInitiatorPlayerId,
    );
    return this.resolveTurnEnd(next, playerId, false, turnInitiatorPlayerId);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos] as GaloponsTile | undefined;
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );
    const description = toText(tile.description);
    if (description.length > 0) {
      next = this.core.appendLog(next, description);
    }
    if (tile.type === 'card') {
      next = this.core.appendLog(next, `Piochez une carte Aventure.`);
    } else if (tile.type === 'bonus') {
      next = this.core.appendLog(next, `Gagnez des pommes.`);
    } else if (tile.type === 'skip') {
      next = this.core.appendLog(next, `Passez des tours.`);
    } else if (tile.type === 'finish') {
      next = this.core.appendLog(next, `Écurie finale.`);
    }

    // Si arrivée : déclenche fin de manche.
    if (tile.type === 'finish') {
      if (!meta.finish?.triggered) {
        const others = Object.keys(meta.positions ?? {})
          .map(Number)
          .filter((id) => Number.isFinite(id) && id !== playerId);
        meta = {
          ...meta,
          apples: {
            ...meta.apples,
            [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
          },
          finish: {
            triggered: true,
            starterId: playerId,
            pendingIds: others,
            bonusGiven: true,
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} atteint l'Écurie finale (+1 pomme).`,
        );
      }
      return next;
    }

    // Si case occupée : l'autre recule de 5.
    const occupant = this.findOccupant(meta, playerId, pos);
    if (occupant != null) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} rattrape ${resolvePlayerNameFromState(next, occupant)} : ${resolvePlayerNameFromState(next, occupant)} recule de 5 cases.`,
      );
      next = this.move(next, occupant, -5);
      meta = this.getMeta(next);
    }

    if (tile.type === 'bonus') {
      const gain = typeof tile.apples === 'number' ? tile.apples : 1;
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} gagne ${gain} pomme(s).`,
      );
    }

    if (tile.type === 'skip') {
      const turns = typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
      const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses.skipTurn ?? {}),
            [playerId]: curr + turns,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} passe ${turns} tour(s).`,
      );
    }

    if (tile.type === 'card') {
      return this.createSynchronizedPending(
        next,
        {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Aventure (Espace).',
        },
        turnInitiatorPlayerId,
      );
    }

    return next;
  }

  private applyDrawCard(
    state: GameStateEntity,
    playerId: number,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;
    next = this.core.appendLog(next, `Carte Aventure : ${draw.card.text}`);
    return this.applyCard(next, playerId, draw.card, turnInitiatorPlayerId);
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: GaloponsCard,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    if (card.effect) {
      return this.applyStructuredCardEffect(
        state,
        playerId,
        card,
        card.effect,
        turnInitiatorPlayerId,
      );
    }

    return this.applyTextCardEffect(
      state,
      playerId,
      card,
      turnInitiatorPlayerId,
    );
  }

  private applyStructuredCardEffect(
    state: GameStateEntity,
    playerId: number,
    card: GaloponsCard,
    effect: GaloponsCardEffect,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    switch (effect.kind) {
      case 'move':
        next = this.move(next, playerId, effect.delta);
        return this.applyLanding(next, playerId, turnInitiatorPlayerId);
      case 'move_to_next_region': {
        const nextPos = findNext(
          meta.tiles,
          meta.positions[playerId] ?? 0,
          (tile) => tile.region === effect.region,
        );
        if (nextPos != null) {
          next = this.setPos(next, playerId, nextPos);
          return this.applyLanding(next, playerId, turnInitiatorPlayerId);
        }
        return next;
      }
      case 'replay':
        meta = { ...meta, keepTurn: true } as GaloponsMetadata & {
          keepTurn?: boolean;
        };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      case 'gain_apples':
        meta = {
          ...meta,
          apples: {
            ...meta.apples,
            [playerId]: (meta.apples?.[playerId] ?? 0) + effect.count,
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} gagne ${effect.count} pomme${effect.count > 1 ? 's' : ''}.`,
        );
      case 'skip_turn': {
        const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + effect.count },
          },
        };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      case 'give_apple_with_iou':
        return this.createChooseTargetPending(next, playerId, {
          kind: 'give_apple',
          actorId: playerId,
          replayAfter: false,
        }, turnInitiatorPlayerId);
      case 'discard_apple_and_replay': {
        const apples = meta.apples?.[playerId] ?? 0;
        if (apples > 0) {
          meta = {
            ...meta,
            apples: {
              ...meta.apples,
              [playerId]: apples - 1,
            },
            keepTurn: true,
          } as GaloponsMetadata & { keepTurn?: boolean };
          next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
          return this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} défausse 1 pomme.`,
          );
        }
        meta = { ...meta, keepTurn: true } as GaloponsMetadata & {
          keepTurn?: boolean;
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} n'a pas de pomme à défausser.`,
        );
      }
      case 'help_advance_for_apple':
        return this.createChooseTargetPending(next, playerId, {
          kind: 'help_advance',
          actorId: playerId,
          replayAfter: false,
        }, turnInitiatorPlayerId);
      case 'pair_advance':
        return this.createChooseTargetPending(next, playerId, {
          kind: 'pair_advance',
          actorId: playerId,
          replayAfter: false,
        }, turnInitiatorPlayerId);
      case 'global_skip_turn': {
        const skip = { ...(meta.statuses?.skipTurn ?? {}) };
        for (const id of Object.keys(meta.positions ?? {})
          .map(Number)
          .filter(Number.isFinite)) {
          skip[id] = (skip[id] ?? 0) + effect.count;
        }
        meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      case 'discard_apple': {
        const apples = meta.apples?.[playerId] ?? 0;
        if (apples > 0) {
          meta = { ...meta, apples: { ...meta.apples, [playerId]: apples - 1 } };
          return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} n'a pas de pomme à défausser.`,
        );
      }
      default:
        return this.applyTextCardEffect(
          state,
          playerId,
          card,
          turnInitiatorPlayerId,
        );
    }
  }

  private applyTextCardEffect(
    state: GameStateEntity,
    playerId: number,
    card: GaloponsCard,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const text = card.text;
    const replayAfter = /Rejouez/i.test(text);

    if (/Donnez-lui une pomme en la défaussant/i.test(text)) {
      const apples = meta.apples?.[playerId] ?? 0;
      if (apples > 0) {
        meta = {
          ...meta,
          apples: {
            ...meta.apples,
            [playerId]: apples - 1,
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} défausse 1 pomme.`,
        );
      } else {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} n'a pas de pomme à défausser.`,
        );
      }
      if (replayAfter) {
        asRecord(meta).keepTurn = true;
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      return next;
    }

    // Donner une pomme (peut être combiné avec "Rejouez immédiatement").
    if (/Donnez-lui une pomme/i.test(text)) {
      const targets = this.otherPlayers(next, playerId);
      const pending: PendingState = {
        type: 'choose_target',
        label: 'Choisissez un joueur dans la liste, puis Entrée.',
        playerId,
        blocking: true,
        choices: targets.map((t) => t.username),
        data: {
          targets: targets.map((t) => ({
            targetPlayerId: t.id,
            targetUsername: t.username,
          })),
        },
      };
      return this.createChooseTargetPending(next, playerId, {
        kind: 'give_apple',
        actorId: playerId,
        replayAfter,
      }, turnInitiatorPlayerId);
    }

    // Rejouer.
    if (/Rejouez/i.test(text)) {
      asRecord(meta).keepTurn = true;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Pomme(s).
    const apples = text.match(/Recevez\s+(\d+)\s+jetons?\s+Pomme/i);
    if (apples) {
      const gain = Number(apples[1]) || 0;
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} gagne ${gain} pomme(s).`,
      );
    }
    if (
      /Recevez un jeton pomme/i.test(text) ||
      /Gagnez 1 jeton Pomme/i.test(text)
    ) {
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} gagne 1 pomme.`,
      );
    }

    // Passe ton tour.
    if (/Passez votre tour/i.test(text)) {
      const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Tous restent sur place pendant un tour.
    if (/Tous les joueurs restent sur place pendant un tour/i.test(text)) {
      const skip = { ...(meta.statuses.skipTurn ?? {}) };
      for (const id of Object.keys(meta.positions ?? {})
        .map(Number)
        .filter(Number.isFinite)) {
        skip[id] = (skip[id] ?? 0) + 1;
      }
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Choisir un joueur et avancer tous les deux.
    if (
      /Choisissez un joueur et avancez (?:tout|tous) les deux d['’]une case/i.test(
        text,
      )
    ) {
      const targets = this.otherPlayers(next, playerId);
      const pending: PendingState = {
        type: 'choose_target',
        label: 'Choisissez un joueur dans la liste, puis Entrée.',
        playerId,
        blocking: true,
        choices: targets.map((t) => t.username),
        data: {
          targets: targets.map((t) => ({
            targetPlayerId: t.id,
            targetUsername: t.username,
          })),
        },
      };
      return this.createChooseTargetPending(next, playerId, {
        kind: 'pair_advance',
        actorId: playerId,
        replayAfter,
      }, turnInitiatorPlayerId);
    }

    // Aider un autre joueur en +2 et recevoir une pomme.
    if (/aidez un autre joueur en le faisant avancer de 2 cases/i.test(text)) {
      const targets = this.otherPlayers(next, playerId);
      const pending: PendingState = {
        type: 'choose_target',
        label: 'Choisissez un joueur dans la liste, puis Entrée.',
        playerId,
        blocking: true,
        choices: targets.map((t) => t.username),
        data: {
          targets: targets.map((t) => ({
            targetPlayerId: t.id,
            targetUsername: t.username,
          })),
        },
      };
      return this.createChooseTargetPending(next, playerId, {
        kind: 'help_advance',
        actorId: playerId,
        replayAfter,
      }, turnInitiatorPlayerId);
    }

    // Défausser une pomme.
    if (
      /Défaussez-vous d''une pomme/i.test(text) ||
      /Défaussez-vous d'une pomme/i.test(text)
    ) {
      const a = meta.apples?.[playerId] ?? 0;
      if (a > 0) {
        meta = { ...meta, apples: { ...meta.apples, [playerId]: a - 1 } };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} n'a pas de pomme à défausser.`,
      );
    }

    // Avance jusqu'à prochaine région.
    if (/jusqu['’]à la prochaine case forêt/i.test(text)) {
      const nextPos = findNext(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.region === 'foret',
      );
      if (nextPos != null) {
        next = this.setPos(next, playerId, nextPos);
        return this.applyLanding(next, playerId, turnInitiatorPlayerId);
      }
    }
    if (/jusqu['’]à la prochaine case montagne/i.test(text)) {
      const nextPos = findNext(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.region === 'montagne',
      );
      if (nextPos != null) {
        next = this.setPos(next, playerId, nextPos);
        return this.applyLanding(next, playerId, turnInitiatorPlayerId);
      }
    }

    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.move(next, playerId, delta);
      return this.applyLanding(next, playerId, turnInitiatorPlayerId);
    }

    return next;
  }

  private createChooseTargetPending(
    state: GameStateEntity,
    playerId: number,
    pendingContext: GaloponsChooseTargetContext,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    const targets = this.otherPlayers(state, playerId);
    const pending: PendingState = {
      type: 'choose_target',
      label: 'Choisissez un joueur dans la liste, puis Entrée.',
      playerId,
      blocking: true,
      choices: targets.map((target) => target.username),
      data: {
        context: pendingContext,
        targets: targets.map((target) => ({
          targetPlayerId: target.id,
          targetUsername: target.username,
        })),
      },
    };

    return this.createSynchronizedPending(
      state,
      pending,
      turnInitiatorPlayerId,
    );
  }

  private getChooseTargetContext(
    pending: GameStateEntity['pending'],
  ): GaloponsChooseTargetContext | null {
    const data = asRecord(asRecord(pending).data);
    const raw = asRecord(data.context);
    const kind = toText(raw.kind);
    const actorId = Number(raw.actorId);
    if (
      (kind !== 'pair_advance' &&
        kind !== 'give_apple' &&
        kind !== 'help_advance') ||
      !Number.isFinite(actorId)
    ) {
      return null;
    }
    return {
      kind,
      actorId,
      replayAfter: raw.replayAfter === true,
    };
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const entries = Object.entries(meta.apples ?? {}).map(([id, a]) => ({
      id: Number(id),
      apples: Number(a),
    }));
    const best = entries
      .filter((e) => Number.isFinite(e.id))
      .sort((a, b) => b.apples - a.apples)[0];
    if (!best) return { ...state, status: 'finished' };
    const nextMeta: GaloponsMetadata = { ...meta, winnerId: best.id };
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
      status: 'finished',
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, best.id)} remporte la partie avec ${best.apples} pomme(s) !`,
    );
    return next;
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    return this.setPos(state, playerId, clamp(pos + delta, 0, 39));
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: GaloponsMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: clamp(pos, 0, 39) },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(meta: GaloponsMetadata): {
    card: GaloponsCard | null;
    meta: GaloponsMetadata;
  } {
    const draw = this.deckPolicies.drawFromPile<GaloponsCard, GaloponsMetadata>(
      {
        meta,
        pile: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
        discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
        useWholeMetaRng: true,
        discardDrawnCard: true,
      },
    );
    return {
      card: draw.card,
      meta: {
        ...draw.meta,
        decks: {
          cards: draw.pile,
          discard: draw.discard,
        },
      },
    };
  }

  private findOccupant(
    meta: GaloponsMetadata,
    me: number,
    pos: number,
  ): number | null {
    for (const [id, p] of Object.entries(meta.positions ?? {})) {
      const pid = Number(id);
      if (!Number.isFinite(pid) || pid === me) continue;
      if ((p ?? 0) === pos) return pid;
    }
    return null;
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

  private ensurePawnSelection(state: GameStateEntity): GameStateEntity {
    const pendingType = toText(asRecord(state.pending).type);
    if (pendingType.length > 0) {
      return state;
    }

    let next = state;
    let players = Array.isArray(next.players) ? next.players : [];
    let meta = this.getMeta(next);
    next = assignConfiguredBotPawns({
      state: next,
      core: this.core,
      catalog: (Array.isArray(meta.pawns) ? meta.pawns : []).map((pawn) => ({
        id: toText(pawn.id),
        label: toText(pawn.name) || toText(pawn.id),
        description: toText(pawn.description),
      })),
      metadataAssignmentKey: 'pawnByPlayerId',
      playerPawnField: 'pawn',
      playerPawnLabelField: 'pawnLabel',
      logLabelResolver: (choice) => toText(choice.label) || toText(choice.id),
    });
    players = Array.isArray(next.players) ? next.players : [];
    meta = this.getMeta(next);
    const pawnByPlayerId = meta.pawnByPlayerId ?? {};
    const availablePawns = (Array.isArray(meta.pawns) ? meta.pawns : [])
      .filter((pawn) => !Object.values(pawnByPlayerId).includes(pawn.id))
      .map((pawn) => ({
        id: toText(pawn.id),
        label: toText(pawn.name) || toText(pawn.id),
        description: toText(pawn.description),
      }))
      .filter((pawn) => pawn.id.length > 0);

    return continueSequentialPawnSelection({
      state: next,
      setupFlow: this.setupFlow,
      core: this.core,
      chooserPlayerId: meta.setupStarterId ?? players[0]?.id ?? null,
      players,
      isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
      pawns: availablePawns,
      starterId: meta.setupStarterId ?? players[0]?.id ?? null,
      pawnDataMapper: (choice) => ({
        id: toText(choice.id),
        label: toText(choice.label),
        description: toText(choice.description),
      }),
    });
  }

  private getMeta(state: GameStateEntity): GaloponsMetadata {
    return (state.metadata ?? {}) as GaloponsMetadata;
  }

  private createSynchronizedPending(
    state: GameStateEntity,
    pending: PendingState,
    turnInitiatorPlayerId: number | null = null,
  ): GameStateEntity {
    const resolvedInitiatorPlayerId = this.resolveInitiatorPlayerId(
      state,
      null,
      turnInitiatorPlayerId ??
        (typeof pending.playerId === 'number' ? pending.playerId : null),
    );
    const ownerPlayerId =
      typeof pending.playerId === 'number' ? pending.playerId : null;
    const next = createPendingState(state, {
      ...pending,
      initiatorPlayerId: resolvedInitiatorPlayerId,
    });
    return this.setCurrentTurnPlayer(next, ownerPlayerId);
  }

  private resolveInitiatorPlayerId(
    state: GameStateEntity,
    pending: GameStateEntity['pending'],
    fallbackPlayerId: number | null,
  ): number | null {
    const pendingRow = asRecord(pending);
    const rawInitiatorPlayerId = pendingRow.initiatorPlayerId;
    const pendingInitiatorPlayerId =
      typeof rawInitiatorPlayerId === 'number' &&
      Number.isFinite(rawInitiatorPlayerId)
        ? rawInitiatorPlayerId
        : Number.NaN;
    if (Number.isFinite(pendingInitiatorPlayerId)) {
      return pendingInitiatorPlayerId;
    }
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (typeof currentPlayerId === 'number' && Number.isFinite(currentPlayerId)) {
      return currentPlayerId;
    }
    return fallbackPlayerId;
  }

  private setCurrentTurnPlayer(
    state: GameStateEntity,
    playerId: number | null,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
      return state;
    }
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId === playerId) {
      return state;
    }
    return {
      ...state,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: playerId,
        direction: state.turn?.direction ?? 1,
      },
    };
  }

  private resolveTurnEnd(
    state: GameStateEntity,
    currentId: number,
    replayAfter = false,
    advanceFromPlayerId = currentId,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    if (meta.finish?.triggered) {
      const pendingIds = meta.finish.pendingIds.filter((id) => id !== currentId);
      if (pendingIds !== meta.finish.pendingIds) {
        meta = { ...meta, finish: { ...meta.finish, pendingIds } };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
    }

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;
    if (meta.finish?.triggered) {
      // The final round gives each remaining player exactly one turn.
      // Ignore any leftover replay effect once the finish phase has started.
      if (asRecord(meta).keepTurn === true) {
        meta = { ...meta };
        delete asRecord(meta).keepTurn;
        next = { ...next, metadata: meta };
      }
      if (meta.finish.pendingIds.length === 0) {
        return this.finishGame(next);
      }
      return this.turns.advanceTurn(
        this.setCurrentTurnPlayer(next, advanceFromPlayerId),
      );
    }

    const keepTurn = replayAfter || asRecord(meta).keepTurn === true;
    if (keepTurn) {
      meta = { ...meta };
      delete asRecord(meta).keepTurn;
      next = {
        ...this.setCurrentTurnPlayer(next, currentId),
        metadata: meta,
      };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} rejoue.`,
      );
    }

    return this.turns.advanceTurn(
      this.setCurrentTurnPlayer(next, advanceFromPlayerId),
    );
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((x) => x?.id === id) ?? null;
    const playerRecord =
      player != null && typeof player === 'object'
        ? (player as Record<string, unknown>)
        : {};
    const explicitLabel =
      typeof playerRecord.pawnLabel === 'string'
        ? String(playerRecord.pawnLabel).trim()
        : '';
    const pawnId =
      toText(meta.pawnByPlayerId?.[id]) ||
      (typeof playerRecord.pawn === 'string'
        ? String(playerRecord.pawn).trim()
        : '');
    const pawn =
      explicitLabel || this.resolvePawnName(meta.pawns, pawnId) || pawnId;
    if (!pawn) return '"son pion"';
    const lower = pawn.toLowerCase();
    const feminine = lower.startsWith('la ') || lower.startsWith('une ');
    const inner = pawn
      .replace(/^l['’]\s*/i, '')
      .replace(/^(le|la|les|un|une)\s+/i, '')
      .trim();
    const core = inner || pawn;
    const lowered =
      core.length <= 1
        ? core.toLowerCase()
        : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
    return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
  }

  private resolvePawnName(
    pawns: GaloponsPawn[] | undefined,
    pawnId: string,
  ): string {
    if (!pawnId) return '';
    const pawn = Array.isArray(pawns)
      ? pawns.find((entry) => toText(entry?.id) === pawnId)
      : null;
    return toText(pawn?.name);
  }

  private normalizePawnChoiceLabel(value: string): string {
    const label = toText(value);
    if (!label) return '';
    const idx = label.indexOf(':');
    if (idx > 0) {
      const left = label.slice(0, idx).trim();
      if (left.length > 0) return left;
    }
    return label;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function extractMoveDelta(text: string): number {
  const numWords: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };

  const parseNumberish = (raw: string): number => {
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
    const key = raw.trim().toLowerCase();
    return numWords[key] ?? 0;
  };

  const forwardApos = text.match(/Avancez\s+d['’]\s*(\d+)\s+case/i);
  if (forwardApos) return Number(forwardApos[1]) || 0;
  const forwardOneApos = text.match(/Avancez\s+d['’]\s*(un|une)\s+case/i);
  if (forwardOneApos) return 1;

  const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
  if (forward) return Number(forward[1]) || 0;
  const forwardWords = text.match(
    /Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardWords) return parseNumberish(forwardWords[1]);

  const backApos = text.match(/Reculez\s+d['’]\s*(\d+)\s+case/i);
  if (backApos) return -(Number(backApos[1]) || 0);
  const backOneApos = text.match(/Reculez\s+d['’]\s*(un|une)\s+case/i);
  if (backOneApos) return -1;

  const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
  if (back) return -(Number(back[1]) || 0);
  const backWords = text.match(
    /Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backWords) return -parseNumberish(backWords[1]);

  return 0;
}

function findNext(
  tiles: GaloponsTile[],
  start: number,
  predicate: (t: GaloponsTile) => boolean,
): number | null {
  for (let i = start + 1; i < tiles.length; i += 1) {
    if (predicate(tiles[i])) return i;
  }
  return null;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}
