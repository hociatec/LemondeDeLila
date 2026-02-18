import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type {
  TaxiExpressClientCard,
  TaxiExpressEventCard,
  TaxiExpressMetadata,
} from '../model/taxi-state.entity';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';



@Injectable()
export class TaxiExpressActionService {
  private static readonly TRIPS_TO_WIN = 5;

  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
          const type = normalizeLowerActionType(action);
          return dispatchByActionType(
            type,
            {
              'roll': () => {
                next = this.handleRoll(next);
                return next;
              },
              'roll dice': () => {
                next = this.handleRoll(next);
                return next;
              },
            },
            () => next,
          );
        });
        return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let next = this.ensureActiveClient(state, playerId);
    next = this.ensureEventForPlayer(next, playerId);
    let meta = this.getMeta(next);
    const clientId = meta.activeClients?.[playerId] ?? null;
    const client = clientId != null ? this.findClient(meta, clientId) : null;
    if (!client) return next;

    const rollResult = this.random.rollDice(meta as any, 6);
    const afterRollMeta: TaxiExpressMetadata = {
      ...meta,
      ...rollResult.meta,
    };
    next = {
      ...next,
      lastRoll: rollResult.roll,
      metadata: { ...(next.metadata ?? {}), ...afterRollMeta },
    };

    const startIndex = meta.positions?.[playerId] ?? 0;
    meta = afterRollMeta;
    const finalIndex = Math.min(
      Math.max(0, (meta.tiles?.length ?? 1) - 1),
      startIndex + rollResult.roll,
    );

    next = this.setPlayerPosition(next, playerId, finalIndex);
    const arrivedTile = this.getTileByIndex(this.getMeta(next), finalIndex);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} avance de ${rollResult.roll} case(s) et place son taxi en case ${finalIndex + 1} (${arrivedTile?.title ?? `case ${finalIndex + 1}`}).`,
    );

    meta = this.getMeta(next);
    const pathIndices = this.buildPathIndices(startIndex + 1, finalIndex);
    const blockedIndex = this.findTileIndexById(meta, meta.blockedTileId);
    if (blockedIndex != null && pathIndices.includes(blockedIndex)) {
      const blockedTile = this.getTileByIndex(meta, blockedIndex);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(
          next,
          playerId,
        )} croise l’événement ${blockedTile?.title ?? `case ${meta.blockedTileId}`}, le client descend et le taxi retourne à la station.`,
      );
      next = this.setPlayerPosition(next, playerId, 0);
      next = this.dropActiveClient(next, playerId);
      return this.turns.advanceTurn(next);
    }

    const destinationIndex = this.findTileIndexById(meta, client.destinationId);
    if (destinationIndex === finalIndex) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(
          next,
          playerId,
        )} dépose ${client.clientName} à destination (${arrivedTile?.title ?? ''}).`,
      );
      next = this.incrementTrip(next, playerId);
      const completed = this.getMeta(next).completedTrips?.[playerId] ?? 0;
      if (completed >= TaxiExpressActionService.TRIPS_TO_WIN) {
        next = this.setWinner(next, playerId, completed);
        return { ...next, status: 'finished' };
      }
      next = this.dropActiveClient(next, playerId);
      next = this.ensureActiveClient(next, playerId);
      return this.turns.advanceTurn(next);
    }

    return this.turns.advanceTurn(next);
  }

  private ensureActiveClient(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const existing = meta.activeClients?.[playerId];
    if (existing != null) return state;

    const draw = this.drawClientCard(meta);
    const updatedMeta: TaxiExpressMetadata = {
      ...draw.meta,
      activeClients: {
        ...meta.activeClients,
        [playerId]: draw.cardId,
      },
    };
    let next = this.replaceMeta(state, updatedMeta);
    if (draw.cardId != null) {
      const card = this.findClient(updatedMeta, draw.cardId);
      if (card) {
        next = this.core.appendLog(
          next,
          `Nouveau client : ${card.clientName} vers ${this.tileTitleById(
            updatedMeta,
            card.destinationId,
          )}.`,
        );
      }
    } else {
      next = this.core.appendLog(
        next,
        'Aucun client disponible pour le moment.',
      );
    }
    return next;
  }

  private ensureEventForPlayer(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.eventTurnPlayerId === playerId && meta.lastEventId != null) {
      return state;
    }
    const draw = this.drawEventCard(meta);
    const nextMeta: TaxiExpressMetadata = {
      ...draw.meta,
      eventTurnPlayerId: playerId,
      blockedTileId: draw.card?.blockedTileId ?? null,
      lastEventId: draw.card?.id ?? null,
    };
    let next = this.replaceMeta(state, nextMeta);
    if (draw.card) {
      const tile = this.tileTitleById(nextMeta, draw.card.blockedTileId);
      next = this.core.appendLog(
        next,
        `Événement : ${draw.card.title} (${tile}) – ${draw.card.description}`,
      );
    } else {
      next = this.core.appendLog(
        next,
        'Événement : la ville est calme, aucun obstacle identifié.',
      );
    }
    return next;
  }

  private incrementTrip(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.completedTrips?.[playerId] ?? 0;
    const updated: TaxiExpressMetadata = {
      ...meta,
      completedTrips: {
        ...(meta.completedTrips ?? {}),
        [playerId]: current + 1,
      },
    };
    return this.replaceMeta(state, updated);
  }

  private setWinner(
    state: GameStateEntity,
    playerId: number,
    completed: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta: TaxiExpressMetadata = {
      ...meta,
      winnerId: playerId,
    };
    let next: GameStateEntity = {
      ...state,
      status: 'finished',
      metadata: { ...(state.metadata ?? {}), ...updatedMeta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} remporte la course avec ${completed} trajets validés !`,
    );
    return next;
  }

  private dropActiveClient(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta: TaxiExpressMetadata = {
      ...meta,
      activeClients: {
        ...(meta.activeClients ?? {}),
        [playerId]: null,
      },
    };
    return this.replaceMeta(state, updatedMeta);
  }

  private drawClientCard(meta: TaxiExpressMetadata): {
    cardId: number | null;
    meta: TaxiExpressMetadata;
  } {
    const draw = this.deckPolicies.drawFromPile<number, TaxiExpressMetadata>({
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
        deckClients: draw.pile as number[],
        discardClients: draw.discard as number[],
      },
    };
  }

  private drawEventCard(meta: TaxiExpressMetadata): {
    card: TaxiExpressEventCard | null;
    meta: TaxiExpressMetadata;
  } {
    const draw = this.deckPolicies.drawFromPile<number, TaxiExpressMetadata>({
      meta,
      pile: Array.isArray(meta.deckEvents) ? meta.deckEvents : [],
      discard: Array.isArray(meta.discardEvents) ? meta.discardEvents : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta = {
      ...draw.meta,
      deckEvents: draw.pile as number[],
      discardEvents: draw.discard as number[],
    };
    const card = draw.card == null ? null : this.findEvent(nextMeta, draw.card);
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

  private setPlayerPosition(
    state: GameStateEntity,
    playerId: number,
    index: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta: TaxiExpressMetadata = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [playerId]: index,
      },
    };
    return this.replaceMeta(state, updatedMeta);
  }

  private replaceMeta(
    state: GameStateEntity,
    meta: TaxiExpressMetadata,
  ): GameStateEntity {
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
  }

  private getMeta(state: GameStateEntity): TaxiExpressMetadata {
    return (state.metadata ?? {}) as TaxiExpressMetadata;
  }

  private findClient(
    meta: TaxiExpressMetadata,
    cardId: number | null,
  ): TaxiExpressClientCard | null {
    if (!cardId) return null;
    return (meta.clients ?? []).find((c) => c.id === cardId) ?? null;
  }

  private findEvent(
    meta: TaxiExpressMetadata,
    cardId: number,
  ): TaxiExpressEventCard | null {
    return (meta.events ?? []).find((event) => event.id === cardId) ?? null;
  }

  private findTileIndexById(
    meta: TaxiExpressMetadata,
    tileId: number | null,
  ): number | null {
    if (tileId == null) return null;
    const index = (meta.tiles ?? []).findIndex((tile) => tile.id === tileId);
    return index >= 0 ? index : null;
  }

  private getTileByIndex(
    meta: TaxiExpressMetadata,
    index: number,
  ): { title: string } | null {
    const tiles = meta.tiles ?? [];
    if (index < 0 || index >= tiles.length) return null;
    return tiles[index];
  }

  private tileTitleById(meta: TaxiExpressMetadata, tileId: number | null): string {
    const index = this.findTileIndexById(meta, tileId);
    const tile = index != null ? this.getTileByIndex(meta, index) : null;
    return tile?.title ?? `case ${tileId ?? '?'}`;
  }
}





