import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../../contracts/room-payload.model';
import type { RoomRecord } from '../../contracts/room-record.model';
import { CatalogService } from '../../../../catalog/public-api';
import { buildUniqueActiveRoomPlayers } from '../membership/room-participant-roster';

@Injectable()
export class RoomPayloadBuilderService {
  constructor(private readonly catalog: CatalogService) {}

  async build(room: RoomRecord): Promise<RoomPayload> {
    const manifest = await this.catalog.getGame(room.gameType);
    const players = buildUniqueActiveRoomPlayers(room.participants);
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
          players: players.length,
          spectators: 0,
        },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players,
        spectators: [],
        bots: (room.bots || []).map((bot) => ({ id: bot.id, name: bot.name })),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
/** Room application capability boundary. */
