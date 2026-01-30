import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { MISSION_GALAXIE_GAME } from '../definitions/mission-galaxie.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { MissionGalaxieMetadata } from '../model/mission-galaxie-state.entity';

@Injectable()
export class MissionGalaxiePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as MissionGalaxieMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const pendingContext = meta.pendingContext ?? null;
    const pendingCard =
      pendingContext && pendingContext.kind !== 'choosePlayerMove'
        ? {
            kind: pendingContext.kind,
            title: pendingContext.card.title,
            prompt: pendingContext.card.prompt,
            choices: pendingContext.card.choices,
          }
        : null;

    return {
      ...state,
      catalog: {
        phases: MISSION_GALAXIE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        pendingCard,
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: this.boardPayload.buildPositionPanelMessage({
                tilesRaw: meta.tiles,
                positionsRaw: meta.positions,
                playerId: userId,
              }),
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as any;
  }
}
