import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../dto/room-response.dto';
import { Room } from '../entities/room.entity';
import { CatalogService } from '../../catalog/services/catalog.service';

@Injectable()
export class RoomPayloadBuilderService {
  constructor(private readonly catalog: CatalogService) {}

  async build(room: Room): Promise<RoomPayload> {
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
        runId:
          typeof (room as any).runId === 'number' ? (room as any).runId : null,
        tableAmbienceSoundId:
          typeof (room as any).tableAmbienceSoundId === 'string'
            ? String((room as any).tableAmbienceSoundId).trim() || null
            : null,
        counts: {
          players: (room.participants || []).filter((participant) => !participant.leftAt)
            .length,
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
