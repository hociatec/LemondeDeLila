import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import { MON_VILLAGE_GAME } from '../definitions/mon-village.definition';
import * as Rulebook from '../rulebook/rulebook';
import type {
  MonVillageCollection,
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

    return {
      ...state,
      catalog: {
        phases: MON_VILLAGE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type === 'roll' ? 'Lancer le dé' : action.type,
        payload: action.payload ?? {},
      })),
      pending: state.pending ?? null,
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
            cartes: {
              title: 'Cartes',
              message: this.buildCollectionMessage(collection),
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
}
