import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { SAC_A_MALICES_GAME } from '../definitions/sac-a-malices.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { SacMetadata } from '../model/sac-a-malices.types';
import { SAC_VARIANTS } from '../sac-a-malices-variants';

@Injectable()
export class SacAMalicesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as SacMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const money = meta.money?.[userId] ?? 0;
    const pending =
      this.buildVariantPrompt(meta, players, userId) ?? state.pending ?? null;
    const propertyPanels = this.buildPropertyPanels(meta, players, userId);
    const stateRecord = state as unknown as Record<string, unknown>;
    const extrasBase =
      stateRecord.extras && typeof stateRecord.extras === 'object'
        ? (stateRecord.extras as Record<string, unknown>)
        : {};

    return {
      ...state,
      catalog: {
        phases: SAC_A_MALICES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending,
      extras: {
        ...extrasBase,
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
            properties_all: {
              title: 'Propriétés',
              message: propertyPanels.all,
            },
            properties_mine: {
              title: 'Mes propriétés',
              message: propertyPanels.mine,
            },
            properties_others: {
              title: 'Propriétés des autres',
              message: propertyPanels.others,
            },
            properties_available: {
              title: 'Propriétés disponibles',
              message: propertyPanels.available,
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    };
  }

  private buildVariantPrompt(
    meta: SacMetadata,
    players: Array<{ id: number }>,
    userId: number,
  ): {
    type: string;
    playerId: number;
    label: string;
    blocking: boolean;
    choices: string[];
  } | null {
    if ((meta.setupStep ?? '') !== 'setup_config') return null;
    const metadataRecord = meta as unknown as Record<string, unknown>;
    const rawOwnerId = metadataRecord.ownerPlayerId;
    const ownerId =
      typeof rawOwnerId === 'number' ? rawOwnerId : (players[0]?.id ?? null);
    if (ownerId == null || ownerId !== userId) return null;

    const choices = SAC_VARIANTS.map((variant) => variant.label).filter(
      (label) => label && label.trim(),
    );
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

  private buildPropertyPanels(
    meta: SacMetadata,
    players: Array<{ id: number; username?: string }>,
    userId: number,
  ): { all: string; mine: string; others: string; available: string } {
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const ownership = meta.ownership ?? {};
    const nameById = new Map<number, string>(
      players
        .filter((p) => typeof p?.id === 'number')
        .map((p) => [
          p.id,
          typeof p?.username === 'string' && p.username.trim().length > 0
            ? p.username.trim()
            : `Joueur ${p.id}`,
        ]),
    );

    const ownable = tiles
      .map((tile, idx) => ({ tile, idx }))
      .filter(({ tile }) =>
        ['property', 'station', 'utility'].includes(String(tile?.type ?? '')),
      );

    const formatTile = (
      _idx: number,
      title: string,
      ownerId: number | null,
    ) => {
      if (ownerId == null) return `${title} (libre)`;
      const ownerName = nameById.get(ownerId) ?? `Joueur ${ownerId}`;
      return `${title} (${ownerName})`;
    };

    const all = ownable.map(({ tile, idx }) =>
      formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx] ?? null),
    );
    const mine = ownable
      .filter(({ idx }) => ownership[idx] === userId)
      .map(({ tile, idx }) =>
        formatTile(idx, tile.title ?? `Case ${idx + 1}`, userId),
      );
    const others = ownable
      .filter(({ idx }) => ownership[idx] != null && ownership[idx] !== userId)
      .map(({ tile, idx }) =>
        formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx]),
      );
    const available = ownable
      .filter(({ idx }) => ownership[idx] == null)
      .map(({ tile, idx }) =>
        formatTile(idx, tile.title ?? `Case ${idx + 1}`, null),
      );

    return {
      all: all.length ? all.join('\n') : 'Aucune propriété.',
      mine: mine.length ? mine.join('\n') : 'Aucune propriété.',
      others: others.length ? others.join('\n') : 'Aucune propriété.',
      available: available.length ? available.join('\n') : 'Aucune propriété.',
    };
  }
}
