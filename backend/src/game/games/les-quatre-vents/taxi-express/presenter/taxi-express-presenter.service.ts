import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as Rulebook from '../rulebook/rulebook';
import { TAXI_EXPRESS_GAME } from '../definitions/taxi-express.definition';
import type {
  TaxiExpressClientCard,
  TaxiExpressEventCard,
  TaxiExpressMetadata,
} from '../model/taxi-state.entity';

const TRIPS_TO_WIN = 5;

@Injectable()
export class TaxiExpressPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const client = this.getActiveClient(meta, userId);
    const event = this.getActiveEvent(meta);
    const completed = meta.completedTrips?.[userId] ?? 0;
    const players = Array.isArray(state.players) ? state.players : [];
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const count = meta.completedTrips?.[p?.id ?? -1] ?? 0;
      return `${name} : ${count} trajet${count > 1 ? 's' : ''}`;
    });

    const stateRecord = asRecord(state);
    const baseExtras = asRecord(stateRecord.extras);
    return {
      ...state,
      catalog: {
        phases: TAXI_EXPRESS_GAME.phaseOrder.map((phase) => phase.id),
        victory:
          meta.winnerId != null
            ? {
                winnerId: meta.winnerId,
              }
            : null,
      },
      actions: formatPresenterActions(actions, () => 'Lancer le dé'),
      pending: state.pending ?? null,
      extras: {
        ...baseExtras,
        taxi: {
          currentClient: client
            ? `${client.clientName} vers ${this.tileTitle(
                meta,
                client.destinationId,
              )}`
            : 'Aucun client à bord.',
          route: client?.route ?? 'Aucun trajet en cours.',
          stats: `Trajets complétés : ${completed} / ${TRIPS_TO_WIN}`,
          event: event
            ? `${event.title} bloque ${this.tileTitle(
                meta,
                event.blockedTileId,
              )}.`
            : 'Pas d’obstacle identifié.',
        },
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: this.boardPayload.buildPositionPanelMessage({
                tilesRaw: meta.tiles,
                positionsRaw: meta.positions,
                playerId: userId,
                playersRaw: state.players,
              }),
            },
            score: {
              title: 'Trajets',
              message: scoreLines.length
                ? scoreLines.join('\n')
                : 'Trajets: indisponible.',
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as GameStateWithActions;
  }

  private getMeta(state: GameStateEntity): TaxiExpressMetadata {
    return (state.metadata ?? {}) as TaxiExpressMetadata;
  }

  private getActiveClient(
    meta: TaxiExpressMetadata,
    playerId: number,
  ): TaxiExpressClientCard | null {
    const id = meta.activeClients?.[playerId] ?? null;
    if (id == null) return null;
    return meta.clients.find((client) => client.id === id) ?? null;
  }

  private getActiveEvent(
    meta: TaxiExpressMetadata,
  ): TaxiExpressEventCard | null {
    if (meta.lastEventId == null) return null;
    return meta.events.find((event) => event.id === meta.lastEventId) ?? null;
  }

  private tileTitle(meta: TaxiExpressMetadata, tileId: number | null): string {
    if (tileId == null) return 'case inconnue';
    const index = (meta.tiles ?? []).findIndex((tile) => tile.id === tileId);
    const tile = index >= 0 ? meta.tiles[index] : null;
    return tile?.title ?? `case ${tileId}`;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}
