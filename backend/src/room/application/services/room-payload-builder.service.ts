import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../models/room-payload.model';
import type { RoomRecord } from '../models/room-record.model';
import { CatalogService } from '../../../catalog/public-api';

@Injectable()
export class RoomPayloadBuilderService {
  constructor(private readonly catalog: CatalogService) {}

  async build(room: RoomRecord): Promise<RoomPayload> {
    const manifest = await this.catalog.getGame(room.gameType);
    return {
      manifest: manifest
        ? {
            id: manifest.id,
            name: manifest.name,
            minPlayers: manifest.minPlayers ?? 2,
            maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
            chatEnabled: manifest.chatEnabled !== false,
            chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
          }
        : null,
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: room.gameType,
        startedAt: room.startedAt ? room.startedAt.toISOString() : null,
        runId: room.runId,
        tableAmbienceSoundId: room.tableAmbienceSoundId,
        counts: {
          players: (room.participants || []).filter(
            (participant) => !participant.leftAt,
          ).length,
          spectators: 0,
        },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players: (room.participants || [])
          .filter((participant) => !participant.leftAt)
          .map((participant) => ({
            id: participant.user.id,
            username: participant.user.username,
          })),
        spectators: [],
        bots: (room.bots || []).map((bot) => ({ id: bot.id, name: bot.name })),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
