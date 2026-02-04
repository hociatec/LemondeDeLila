import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { SAC_A_MALICES_GAME } from '../definitions/sac-a-malices.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { SacMetadata } from '../model/sac-a-malices.types';
import { SAC_VARIANTS } from '../sac-a-malices-variants';

@Injectable()
export class SacAMalicesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as SacMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const money = meta.money?.[userId] ?? 0;
    const pending = this.buildVariantPrompt(meta, players, userId) ?? state.pending ?? null;

    return {
      ...state,
      catalog: {
        phases: SAC_A_MALICES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending,
      extras: {
        ...(state as any).extras,
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
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
            cash: {
              title: 'Caisse',
              message: `${money} €`,
            },
            parcGratuit: {
              title: 'Parc Gratuit',
              message: `Pot: ${meta.pot ?? 0} €`,
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }

  private buildVariantPrompt(
    meta: SacMetadata,
    players: Array<{ id: number }>,
    userId: number,
  ): any | null {
    if ((meta.setupStep ?? '') !== 'setup_config') return null;
    const ownerId =
      typeof (meta as any)?.ownerPlayerId === 'number'
        ? (meta as any).ownerPlayerId
        : (players[0]?.id ?? null);
    if (ownerId == null || ownerId !== userId) return null;

    const choices = SAC_VARIANTS.map((variant) => variant.label).filter((label) => label && label.trim());
    if (choices.length === 0) {
      return null;
    }

    return {
      type: 'sac_setup_variant',
      playerId: ownerId,
      label: 'Choisissez votre Monopoly',
      blocking: true,
      choices,
    };
  }
}
