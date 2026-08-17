import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import { GameCoreService } from '../../core/services/game-core.service';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeLowerActionType,
} from '../../actions/action-service.helper';
import { DeckPoliciesService } from '../../modules/deck-policies/services/deck-policies.service';
import { RandomService } from '../../modules/random/services/random.service';
import { TurnFlowService } from '../../modules/turn/services/turn-flow.service';
import { resolvePlayerNameFromState } from '../../modules/turn-policies/player-name.helper';
import { BoardMissionRuntimeSupportService } from './board-mission-runtime-support.service';
import type {
  BoardMissionClientCard,
  BoardMissionEventCard,
  BoardMissionFlowStep,
  BoardMissionMetadata,
  BoardMissionResolvedModel,
  BoardMissionRules,
} from './board-mission.types';

type TurnContext = {
  state: GameStateEntity;
  playerId: number;
  roll: number | null;
  startIndex: number;
  finalIndex: number;
  activeClient: BoardMissionClientCard | null;
  arrivedTileTitle: string | null;
  turnResolved: boolean;
  shouldAdvanceTurn: boolean;
  finished: boolean;
};

@Injectable()
export class BoardMissionEngineService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly support: BoardMissionRuntimeSupportService,
  ) {}

  applyActions<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    model: BoardMissionResolvedModel<TRules>,
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeLowerActionType(action);
      return dispatchByActionType(
        type,
        {
          roll: () => this.handleRoll<TMeta, TRules>(next, model),
          'roll dice': () => this.handleRoll<TMeta, TRules>(next, model),
        },
        () => next,
      );
    });
  }

  private handleRoll<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(
    state: GameStateEntity,
    model: BoardMissionResolvedModel<TRules>,
  ): GameStateEntity {
    const rules = model.rules;
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let ctx: TurnContext = {
      state,
      playerId,
      roll: null,
      startIndex: 0,
      finalIndex: 0,
      activeClient: null,
      arrivedTileTitle: null,
      turnResolved: false,
      shouldAdvanceTurn: false,
      finished: false,
    };

    for (const step of rules.turnFlow) {
      ctx = this.applyStep<TMeta, TRules>(ctx, step, rules);
      if (ctx.finished) break;
    }

    return ctx.state;
  }

  private applyStep<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, step: BoardMissionFlowStep, rules: TRules): TurnContext {
    if (ctx.finished) return ctx;
    if (ctx.turnResolved && step.type !== 'advance_turn') return ctx;

    switch (step.type) {
      case 'ensure_active_client':
        return this.applyEnsureActiveClient<TMeta, TRules>(ctx, rules);
      case 'ensure_turn_event':
        return this.applyEnsureTurnEvent<TMeta, TRules>(ctx, rules);
      case 'roll':
        return this.applyRoll<TMeta>(ctx);
      case 'move_by_last_roll':
        return this.applyMove<TMeta, TRules>(ctx, rules);
      case 'resolve_blocked_path':
        return this.applyBlockedPath<TMeta, TRules>(ctx, rules);
      case 'resolve_destination':
        return this.applyDestination<TMeta, TRules>(ctx, rules);
      case 'advance_turn':
        return this.applyAdvanceTurn(ctx);
      default:
        return ctx;
    }
  }

  private applyEnsureActiveClient<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, rules: TRules): TurnContext {
    const nextState = this.ensureActiveClient<TMeta, TRules>(
      ctx.state,
      ctx.playerId,
      rules,
    );
    return {
      ...ctx,
      state: nextState,
      activeClient: this.support.getActiveClient<TMeta>(
        nextState,
        ctx.playerId,
      ),
    };
  }

  private applyEnsureTurnEvent<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, rules: TRules): TurnContext {
    return {
      ...ctx,
      state: this.ensureEventForPlayer<TMeta, TRules>(
        ctx.state,
        ctx.playerId,
        rules,
      ),
    };
  }

  private applyRoll<TMeta extends BoardMissionMetadata>(
    ctx: TurnContext,
  ): TurnContext {
    const client = this.support.getActiveClient<TMeta>(ctx.state, ctx.playerId);
    if (!client) {
      return {
        ...ctx,
        activeClient: null,
        turnResolved: true,
        shouldAdvanceTurn: false,
      };
    }

    const meta = this.support.getMeta<TMeta>(ctx.state);
    const rollResult = this.random.rollDice(meta, 6);
    const nextMeta = {
      ...meta,
      ...rollResult.meta,
    } as TMeta;
    const startIndex = meta.positions?.[ctx.playerId] ?? 0;
    const finalIndex = Math.min(
      Math.max(0, (meta.tiles?.length ?? 1) - 1),
      startIndex + rollResult.roll,
    );

    return {
      ...ctx,
      state: {
        ...ctx.state,
        lastRoll: rollResult.roll,
        metadata: { ...(ctx.state.metadata ?? {}), ...nextMeta },
      },
      roll: rollResult.roll,
      startIndex,
      finalIndex,
      activeClient: client,
      shouldAdvanceTurn: true,
    };
  }

  private applyMove<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, rules: TRules): TurnContext {
    if (!ctx.activeClient || ctx.roll == null) return ctx;

    let nextState = this.setPlayerPosition<TMeta>(
      ctx.state,
      ctx.playerId,
      ctx.finalIndex,
    );
    const meta = this.support.getMeta<TMeta>(nextState);
    const arrivedTileTitle =
      this.support.getTileByIndex(meta, ctx.finalIndex)?.title ??
      `case ${ctx.finalIndex + 1}`;
    nextState = this.core.appendLog(
      nextState,
      this.support.formatMessage(rules.messages.move, {
        player: resolvePlayerNameFromState(nextState, ctx.playerId),
        roll: ctx.roll,
        tileIndex: ctx.finalIndex + 1,
        tileTitle: arrivedTileTitle,
      }),
    );

    return {
      ...ctx,
      state: nextState,
      arrivedTileTitle,
    };
  }

  private applyBlockedPath<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, rules: TRules): TurnContext {
    if (!ctx.activeClient || ctx.roll == null) return ctx;

    const meta = this.support.getMeta<TMeta>(ctx.state);
    const pathIndices = this.buildPathIndices(
      ctx.startIndex + 1,
      ctx.finalIndex,
    );
    const blockedIndex = this.support.findTileIndexById(
      meta,
      meta.blockedTileId,
    );
    if (blockedIndex == null || !pathIndices.includes(blockedIndex)) return ctx;

    const blockedTile = this.support.getTileByIndex(meta, blockedIndex);
    let nextState = this.core.appendLog(
      ctx.state,
      this.support.formatMessage(rules.messages.blocked, {
        player: resolvePlayerNameFromState(ctx.state, ctx.playerId),
        tileTitle:
          blockedTile?.title ??
          `case ${meta.blockedTileId ?? blockedIndex + 1}`,
      }),
    );
    nextState = this.setPlayerPosition<TMeta>(
      nextState,
      ctx.playerId,
      rules.setup.startTileIndex,
    );
    nextState = this.dropActiveClient<TMeta>(nextState, ctx.playerId);

    return {
      ...ctx,
      state: nextState,
      turnResolved: true,
      shouldAdvanceTurn: true,
    };
  }

  private applyDestination<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(ctx: TurnContext, rules: TRules): TurnContext {
    if (!ctx.activeClient || ctx.roll == null) return ctx;

    const meta = this.support.getMeta<TMeta>(ctx.state);
    const destinationIndex = this.support.findTileIndexById(
      meta,
      ctx.activeClient.destinationId,
    );
    if (destinationIndex !== ctx.finalIndex) return ctx;

    let nextState = this.core.appendLog(
      ctx.state,
      this.support.formatMessage(rules.messages.dropoff, {
        player: resolvePlayerNameFromState(ctx.state, ctx.playerId),
        clientName: ctx.activeClient.clientName,
        tileTitle:
          ctx.arrivedTileTitle ??
          this.support.tileTitleById(meta, ctx.activeClient.destinationId),
      }),
    );
    nextState = this.incrementTrip<TMeta>(nextState, ctx.playerId);

    const completed =
      this.support.getMeta<TMeta>(nextState).completedTrips?.[ctx.playerId] ??
      0;
    if (completed >= rules.victory.target) {
      nextState = this.setWinner<TMeta, TRules>(
        nextState,
        ctx.playerId,
        completed,
        rules,
      );
      return {
        ...ctx,
        state: nextState,
        turnResolved: true,
        shouldAdvanceTurn: true,
        finished: true,
      };
    }

    nextState = this.dropActiveClient<TMeta>(nextState, ctx.playerId);
    nextState = this.ensureActiveClient<TMeta, TRules>(
      nextState,
      ctx.playerId,
      rules,
    );

    return {
      ...ctx,
      state: nextState,
      activeClient: this.support.getActiveClient<TMeta>(
        nextState,
        ctx.playerId,
      ),
      turnResolved: true,
      shouldAdvanceTurn: true,
    };
  }

  private applyAdvanceTurn(ctx: TurnContext): TurnContext {
    if (ctx.finished || !ctx.shouldAdvanceTurn) return ctx;
    return {
      ...ctx,
      state: this.turns.advanceTurn(ctx.state),
    };
  }

  private ensureActiveClient<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(state: GameStateEntity, playerId: number, rules: TRules): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    const existing = meta.activeClients?.[playerId];
    if (existing != null) return state;

    const draw = this.drawClientCard<TMeta>(meta);
    const updatedMeta = {
      ...draw.meta,
      activeClients: {
        ...meta.activeClients,
        [playerId]: draw.cardId,
      },
    } as TMeta;
    let next = this.support.replaceMeta(state, updatedMeta);
    if (draw.cardId != null) {
      const card = this.support.findClient(updatedMeta, draw.cardId);
      if (card) {
        next = this.core.appendLog(
          next,
          this.support.formatMessage(rules.messages.newClient, {
            clientName: card.clientName,
            destination: this.support.tileTitleById(
              updatedMeta,
              card.destinationId,
            ),
          }),
        );
      }
    } else {
      next = this.core.appendLog(next, rules.messages.noClientAvailable);
    }
    return next;
  }

  private ensureEventForPlayer<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(state: GameStateEntity, playerId: number, rules: TRules): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    if (meta.eventTurnPlayerId === playerId && meta.lastEventId != null) {
      return state;
    }

    const draw = this.drawEventCard<TMeta>(meta);
    const nextMeta = {
      ...draw.meta,
      eventTurnPlayerId: playerId,
      blockedTileId: draw.card?.blockedTileId ?? null,
      lastEventId: draw.card?.id ?? null,
    } as TMeta;
    let next = this.support.replaceMeta(state, nextMeta);
    if (draw.card) {
      next = this.core.appendLog(
        next,
        this.support.formatMessage(rules.messages.event, {
          title: draw.card.title,
          tile: this.support.tileTitleById(nextMeta, draw.card.blockedTileId),
          description: draw.card.description,
        }),
      );
    } else {
      next = this.core.appendLog(next, rules.messages.noEvent);
    }
    return next;
  }

  private incrementTrip<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    const current = meta.completedTrips?.[playerId] ?? 0;
    const updated = {
      ...meta,
      completedTrips: {
        ...(meta.completedTrips ?? {}),
        [playerId]: current + 1,
      },
    } as TMeta;
    return this.support.replaceMeta(state, updated);
  }

  private setWinner<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(
    state: GameStateEntity,
    playerId: number,
    completed: number,
    rules: TRules,
  ): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    const updatedMeta = {
      ...meta,
      winnerId: playerId,
    } as TMeta;
    let next: GameStateEntity = {
      ...state,
      status: 'finished',
      metadata: { ...(state.metadata ?? {}), ...updatedMeta },
    };
    next = this.core.appendLog(
      next,
      this.support.formatMessage(rules.messages.win, {
        player: resolvePlayerNameFromState(next, playerId),
        count: completed,
      }),
    );
    return next;
  }

  private dropActiveClient<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    const updatedMeta = {
      ...meta,
      activeClients: {
        ...(meta.activeClients ?? {}),
        [playerId]: null,
      },
    } as TMeta;
    return this.support.replaceMeta(state, updatedMeta);
  }

  private drawClientCard<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
  ): {
    cardId: number | null;
    meta: TMeta;
  } {
    const draw = this.deckPolicies.drawFromPile<number, TMeta>({
      meta,
      pile: Array.isArray(meta.deckClients) ? meta.deckClients : [],
      discard: Array.isArray(meta.discardClients) ? meta.discardClients : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    return {
      cardId: draw.card,
      meta: {
        ...draw.meta,
        deckClients: draw.pile,
        discardClients: draw.discard,
      } as TMeta,
    };
  }

  private drawEventCard<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
  ): {
    card: BoardMissionEventCard | null;
    meta: TMeta;
  } {
    const draw = this.deckPolicies.drawFromPile<number, TMeta>({
      meta,
      pile: Array.isArray(meta.deckEvents) ? meta.deckEvents : [],
      discard: Array.isArray(meta.discardEvents) ? meta.discardEvents : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta = {
      ...draw.meta,
      deckEvents: draw.pile,
      discardEvents: draw.discard,
    } as TMeta;
    const card =
      draw.card == null ? null : this.support.findEvent(nextMeta, draw.card);
    return { card, meta: nextMeta };
  }

  private buildPathIndices(start: number, end: number): number[] {
    if (end < start) return [];
    const out: number[] = [];
    for (let idx = start; idx <= end; idx++) {
      out.push(idx);
    }
    return out;
  }

  private setPlayerPosition<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
    playerId: number,
    index: number,
  ): GameStateEntity {
    const meta = this.support.getMeta<TMeta>(state);
    const updatedMeta = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [playerId]: index,
      },
    } as TMeta;
    return this.support.replaceMeta(state, updatedMeta);
  }
}
