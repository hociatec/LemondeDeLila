import { presentationTimestamp } from '../../../../../platform/serialization/public-api';
import { Inject, Injectable } from '@nestjs/common';
import { RoomPayload } from '../../models/room-payload.model';
import type { RoomRecord } from '../../models/room-record.model';
import {
  ROOM_CATALOG_PORT,
  type RoomCatalogPort,
} from '../../ports/room-catalog.port';
import { buildUniqueActiveRoomPlayers } from '../membership/room-participant-roster';
import {
  asGameId,
  asRoomId,
} from '../../../../../shared/interfaces/public-api';

@Injectable()
export class RoomPayloadBuilderService {
  constructor(
    @Inject(ROOM_CATALOG_PORT) private readonly catalog: RoomCatalogPort,
  ) {}

  async build(room: RoomRecord): Promise<RoomPayload> {
    const manifest = await this.catalog.getGame(room.gameType);
    const players = buildUniqueActiveRoomPlayers(room.participants);
    return {
      manifest: manifest
        ? {
            id: asGameId(manifest.id),
            name: manifest.name,
            minPlayers: manifest.minPlayers ?? 2,
            maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
            chatEnabled: manifest.chatEnabled !== false,
            chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
          }
        : null,
      room: {
        id: asRoomId(room.id),
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: asGameId(room.gameType),
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
      generatedAt: presentationTimestamp(),
    };
  }
}
/** Room application capability boundary. */
