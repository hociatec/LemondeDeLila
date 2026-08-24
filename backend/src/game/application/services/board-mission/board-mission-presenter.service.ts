import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../models/game-state.model';
import type { GameStateWithActions } from '../../models/game-action.model';
import { formatPresenterActions } from '../../helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../services/board-payload.service';
import { getBoardMissionAvailableActions } from './board-mission.rulebook';
import { BoardMissionRuntimeSupportService } from './board-mission-runtime-support.service';
import type {
  BoardMissionMetadata,
  BoardMissionResolvedModel,
  BoardMissionRules,
} from '../../models/board-mission.model';

@Injectable()
export class BoardMissionPresenterService {
  constructor(
    private readonly boardPayload: BoardPayloadService,
    private readonly support: BoardMissionRuntimeSupportService,
  ) {}

  exposeStateForUser<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(
    state: GameStateEntity,
    userId: number,
    model: BoardMissionResolvedModel<TRules>,
    game: {
      actionsLabel?: string;
      phases: string[];
      scorePanelTitle?: string;
      idleClientText?: string;
      idleRouteText?: string;
      idleEventText?: string;
    },
  ): GameStateWithActions {
    const actions = getBoardMissionAvailableActions(state, userId);
    const meta = this.support.getMeta<TMeta>(state);
    const client = this.support.getActiveClient<TMeta>(state, userId);
    const event = this.support.getActiveEvent<TMeta>(state);
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
        phases: game.phases,
        victory:
          meta.winnerId != null
            ? {
                winnerId: meta.winnerId,
              }
            : null,
      },
      actions: formatPresenterActions(
        actions,
        () => game.actionsLabel ?? 'Lancer le dÃƒÆ’Ã‚Â©',
      ),
      pending: state.pending ?? null,
      extras: {
        ...baseExtras,
        taxi: {
          currentClient: client
            ? `${client.clientName} vers ${this.support.tileTitleById(meta, client.destinationId)}`
            : (game.idleClientText ?? 'Aucun client ÃƒÆ’Ã‚Â  bord.'),
          route:
            client?.route ?? game.idleRouteText ?? 'Aucun trajet en cours.',
          stats: `Trajets complÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â©s : ${completed} / ${model.rules.victory.target}`,
          event: event
            ? `${event.title} bloque ${this.support.tileTitleById(meta, event.blockedTileId)}.`
            : (game.idleEventText ?? 'Pas dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢obstacle identifiÃƒÆ’Ã‚Â©.'),
        },
        ui: {
          panels: {
            score: {
              title: game.scorePanelTitle ?? 'Trajets',
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
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}




