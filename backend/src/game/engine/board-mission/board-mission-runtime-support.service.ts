import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type {
  BoardMissionClientCard,
  BoardMissionEventCard,
  BoardMissionMetadata,
  BoardMissionTile,
} from './board-mission.types';

type RuntimeMeta<TMeta extends BoardMissionMetadata> = TMeta & Record<string, unknown>;

@Injectable()
export class BoardMissionRuntimeSupportService {
  getMeta<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
  ): RuntimeMeta<TMeta> {
    return (state.metadata ?? {}) as RuntimeMeta<TMeta>;
  }

  replaceMeta<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
    meta: TMeta,
  ): GameStateEntity {
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
  }

  getActiveClient<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
    playerId: number,
  ): BoardMissionClientCard | null {
    const meta = this.getMeta<TMeta>(state);
    const clientId = meta.activeClients?.[playerId] ?? null;
    return this.findClient(meta, clientId);
  }

  getActiveEvent<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
  ): BoardMissionEventCard | null {
    const meta = this.getMeta<TMeta>(state);
    if (meta.lastEventId == null) return null;
    return this.findEvent(meta, meta.lastEventId);
  }

  findClient<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
    cardId: number | null,
  ): BoardMissionClientCard | null {
    if (!cardId) return null;
    return (meta.clients ?? []).find((card) => card.id === cardId) ?? null;
  }

  findEvent<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
    cardId: number,
  ): BoardMissionEventCard | null {
    return (meta.events ?? []).find((event) => event.id === cardId) ?? null;
  }

  findTileIndexById<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
    tileId: number | null,
  ): number | null {
    if (tileId == null) return null;
    const index = (meta.tiles ?? []).findIndex((tile) => tile.id === tileId);
    return index >= 0 ? index : null;
  }

  getTileByIndex<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
    index: number,
  ): BoardMissionTile | null {
    const tiles = meta.tiles ?? [];
    if (index < 0 || index >= tiles.length) return null;
    return tiles[index];
  }

  tileTitleById<TMeta extends BoardMissionMetadata>(
    meta: TMeta,
    tileId: number | null,
  ): string {
    const index = this.findTileIndexById(meta, tileId);
    const tile = index != null ? this.getTileByIndex(meta, index) : null;
    return tile?.title ?? `case ${tileId ?? '?'}`;
  }

  formatMessage(
    template: string,
    values: Record<string, string | number>,
  ): string {
    return Object.entries(values).reduce((message, [key, value]) => {
      return message.replaceAll(`{${key}}`, String(value));
    }, template);
  }
}
