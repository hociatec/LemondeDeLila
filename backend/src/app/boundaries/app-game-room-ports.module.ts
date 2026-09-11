import { Global, Module } from '@nestjs/common';
import {
  GAME_ROOM_CONTEXT_PORT,
  GAME_ROOM_EVENTS_PORT,
  type GameRoomContextPort,
  type GameRoomEventsPort,
} from '../../game/public-api';
import {
  ROOM_GAME_PORT,
  ROOM_EVENTS_PORT,
  type RoomGamePort,
  type RoomEventsPort,
} from '../../modules/room/public-api';
import { RoomModule } from '../../modules/room/composition-api';
import {
  asGameId,
  asRoomId,
  asUserId,
} from '../../shared/interfaces/public-api';
import type { RoomPayload } from '../../modules/room/application/models/room-payload.model';

@Global()
@Module({
  imports: [RoomModule],
  providers: [
    {
      provide: GAME_ROOM_CONTEXT_PORT,
      inject: [ROOM_GAME_PORT],
      useFactory: (rooms: RoomGamePort): GameRoomContextPort => {
        const project = async (payload: RoomPayload) => ({
          room: {
            id: asRoomId(payload.room.id),
            isPrivate: payload.room.isPrivate,
            status: payload.room.status,
            gameType: asGameId(payload.room.gameType),
            startedAt: payload.room.startedAt,
            runId: payload.room.runId,
            owner: payload.room.owner
              ? { id: asUserId(payload.room.owner.id) }
              : null,
            players: payload.room.players.map((player) => ({
              id: asUserId(player.id),
              username: player.username,
            })),
            bots: payload.room.bots,
          },
        });
        return {
          getRoomPayload: async (roomId) =>
            project(await rooms.getRoomPayload(roomId)),
          refreshRoomPayload: async (roomId) =>
            project(await rooms.refreshRoomPayload(roomId)),
          resetRoom: (roomId, userId) => rooms.resetRoom(roomId, userId),
          startRoom: (roomId, userId) => rooms.startRoom(roomId, userId),
          prepareNextRun: (roomId) => rooms.prepareNextRun(roomId),
        };
      },
    },
    {
      provide: GAME_ROOM_EVENTS_PORT,
      inject: [ROOM_EVENTS_PORT],
      useFactory: (events: RoomEventsPort): GameRoomEventsPort => events,
    },
  ],
  exports: [GAME_ROOM_CONTEXT_PORT, GAME_ROOM_EVENTS_PORT],
})
export class AppGameRoomPortsModule {}
