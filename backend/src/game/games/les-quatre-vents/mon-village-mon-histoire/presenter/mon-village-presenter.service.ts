import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { MON_VILLAGE_GAME } from '../definitions/mon-village.definition';
import * as Rulebook from '../rulebook/rulebook';
import type {
  MonVillageCollection,
  MonVillageCard,
  MonVillageMetadata,
} from '../model/mon-village-state.entity';

const ZONE_LABELS: Record<number, string> = {
  1: 'Terre & Nature',
  2: 'Artisanat',
  3: 'Textile & Habillement',
  4: 'Bouche',
  5: 'Quotidien & Services',
  6: 'Savoir & Culture',
  7: 'Protection & Société',
  8: 'Très anciens & universels',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class MonVillagePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as MonVillageMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const collection = meta.collections?.[userId] ?? null;
    const availableMessage = this.buildAvailableMessage(
      (meta.decks ?? {}) as Record<number, MonVillageCard[]>,
    );
    const scoreMessage = this.buildScoresMessage(
      players,
      meta.collections ?? {},
    );

    return {
      ...state,
      catalog: {
        phases: MON_VILLAGE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        action.type === 'roll' ? 'Lancer le dé' : action.type,
      ),
      pending: state.pending ?? null,
      extras: {
        ...asRecord(state.extras),
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        ui: {
          panels: {
            cartes: {
              title: 'Cartes',
              message: this.buildCollectionMessage(collection),
            },
            available: {
              title: 'Disponibles',
              message: availableMessage,
            },
            score: {
              title: 'Scores',
              message: scoreMessage,
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

  private buildCollectionMessage(
    collection: MonVillageCollection | null,
  ): string {
    if (!collection) {
      return 'Cartes totales : 0';
    }
    const lines = [`Cartes totales : ${collection.total}`];
    const zoneEntries = Object.entries(collection.byZone ?? {})
      .map(([zoneId, count]) => ({
        zoneId: Number(zoneId),
        label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
        count,
      }))
      .sort((a, b) => a.zoneId - b.zoneId)
      .map((entry) => `${entry.label} (${entry.count})`);
    if (zoneEntries.length) {
      lines.push(zoneEntries.join(' | '));
    }
    return lines.join('\n');
  }

  private buildAvailableMessage(
    decks: Record<number, MonVillageCard[]>,
  ): string {
    const entries = Object.entries(decks ?? {})
      .map(([zoneId, cards]) => ({
        zoneId: Number(zoneId),
        label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
        count: Array.isArray(cards) ? cards.length : 0,
      }))
      .sort((a, b) => a.zoneId - b.zoneId);

    if (!entries.length) {
      return 'Aucune carte disponible.';
    }

    return entries
      .map((entry) => `${entry.label} (${entry.count})`)
      .join(' | ');
  }

  private buildScoresMessage(
    players: Array<{ id: number; username?: string }>,
    collections: Record<number, MonVillageCollection>,
  ): string {
    if (!players.length) return 'Scores: indisponibles.';

    const lines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const collection = collections?.[p?.id ?? -1] ?? null;
      if (!collection) return `${name} : 0`;
      const zoneEntries = Object.entries(collection.byZone ?? {})
        .map(([zoneId, count]) => ({
          zoneId: Number(zoneId),
          label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
          count,
        }))
        .sort((a, b) => a.zoneId - b.zoneId)
        .map((entry) => `${entry.label} (${entry.count})`);
      const total = collection.total ?? 0;
      return zoneEntries.length
        ? `${name} : ${total} | ${zoneEntries.join(' | ')}`
        : `${name} : ${total}`;
    });

    return lines.join('\n');
  }
}
