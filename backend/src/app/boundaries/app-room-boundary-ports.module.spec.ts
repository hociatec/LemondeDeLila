import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppGameRoomPortsModule } from './app-game-room-ports.module';
import {
  GAME_ROOM_CONTEXT_PORT,
  GAME_ROOM_EVENTS_PORT,
  type GameRoomContextPort,
  type GameRoomEventsPort,
} from '../../game/public-api';
import {
  ROOM_GAME_PORT,
  ROOM_EVENTS_PORT,
} from '../../modules/room/public-api';
import { AppPresenceReadersModule } from './app-presence-readers.module';
import { AppVaultPortsModule } from './app-vault-ports.module';
import { AppBotPortsModule } from './app-bot-ports.module';
import { AppRoomVaultPortsModule } from './app-room-vault-ports.module';
import { AppRoomBotOperationsAdapter } from './app-room-bot-operations.adapter';
import { ROOM_VAULT_PORT } from '../../modules/room/public-api';
import {
  VAULT_ROOM_PORT,
  type VaultRoomPort,
} from '../../modules/vault/public-api';
import { CountRoomBotsService } from '../../modules/bot/public-api';
import {
  BOT_ROOM_REPOSITORY,
  type BotRoomRepository,
} from '../../modules/bot/composition-api';
import { BotModule } from '../../modules/bot/composition-api';
import { ROOM_BOTS_REPOSITORY } from '../../modules/room/composition-api';
import { ACTIVE_ROOM_PARTICIPANTS_READER } from '../../modules/room/public-api';
import {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from '../../modules/room/composition-api';
import { RoomModule } from '../../modules/room/composition-api';
import { OWNED_SNAPSHOT_DELETER } from '../../modules/vault/public-api';
import { VaultModule } from '../../modules/vault/composition-api';
import {
  PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
  type PresenceRoomParticipantRepository,
} from '../../modules/presence/composition-api';
import { asRoomId } from '../../shared/interfaces/public-api';

const participants = {
  listActiveRoomsByUserIds: jest.fn().mockResolvedValue([]),
};
const snapshots = {
  deleteOwnedSnapshot: jest.fn().mockResolvedValue(undefined),
};
const bots = { countBotsForRoom: jest.fn().mockResolvedValue(2) };
const vaultRooms = { getRoomPayload: jest.fn() };
const gameRooms = {
  getRoomPayload: jest.fn().mockResolvedValue({
    room: {
      id: 42,
      isPrivate: false,
      status: 'started',
      gameType: 'example',
      startedAt: null,
      runId: null,
      owner: null,
      players: [],
      bots: [],
    },
  }),
};
const gameEvents = { onRoomDeleted: jest.fn() };

@Module({
  providers: [
    { provide: ACTIVE_ROOM_PARTICIPANTS_READER, useValue: participants },
    { provide: ROOM_BOTS_REPOSITORY, useValue: bots },
    { provide: ROOM_VAULT_PORT, useValue: vaultRooms },
    { provide: ROOM_GAME_PORT, useValue: gameRooms },
    { provide: ROOM_EVENTS_PORT, useValue: gameEvents },
  ],
  exports: [
    ACTIVE_ROOM_PARTICIPANTS_READER,
    ROOM_BOTS_REPOSITORY,
    ROOM_VAULT_PORT,
    ROOM_GAME_PORT,
    ROOM_EVENTS_PORT,
  ],
})
class RoomFixtureModule {}
@Module({
  providers: [{ provide: OWNED_SNAPSHOT_DELETER, useValue: snapshots }],
  exports: [OWNED_SNAPSHOT_DELETER],
})
class VaultFixtureModule {}
@Module({
  providers: [{ provide: CountRoomBotsService, useValue: bots }],
  exports: [CountRoomBotsService],
})
class BotFixtureModule {}
@Injectable()
class Consumer {
  constructor(
    @Inject(PRESENCE_ROOM_PARTICIPANT_REPOSITORY)
    readonly participants: PresenceRoomParticipantRepository,
    @Inject(ROOM_VAULT_SNAPSHOT_REPOSITORY)
    readonly snapshots: RoomVaultSnapshotRepository,
    @Inject(BOT_ROOM_REPOSITORY) readonly bots: BotRoomRepository,
    @Inject(VAULT_ROOM_PORT) readonly vaultRooms: VaultRoomPort,
    @Inject(GAME_ROOM_CONTEXT_PORT) readonly gameRooms: GameRoomContextPort,
    @Inject(GAME_ROOM_EVENTS_PORT) readonly gameEvents: GameRoomEventsPort,
  ) {}
}
@Module({ providers: [Consumer] })
class ConsumerModule {}

it('binds room and vault ports across independent Nest modules', async () => {
  const app = await Test.createTestingModule({
    imports: [
      AppPresenceReadersModule,
      AppVaultPortsModule,
      AppBotPortsModule,
      AppRoomVaultPortsModule,
      AppGameRoomPortsModule,
      ConsumerModule,
    ],
  })
    .overrideModule(RoomModule)
    .useModule(RoomFixtureModule)
    .overrideModule(VaultModule)
    .useModule(VaultFixtureModule)
    .overrideModule(BotModule)
    .useModule(BotFixtureModule)
    .overrideProvider(AppRoomBotOperationsAdapter)
    .useValue({})
    .compile();
  try {
    const consumer = app.get(Consumer);
    expect(consumer.participants).toBe(participants);
    expect(consumer.snapshots).toBe(snapshots);
    expect(consumer.bots).toBe(bots);
    expect(consumer.vaultRooms).toBe(vaultRooms);
    expect(consumer.gameRooms).toEqual(
      expect.objectContaining({ getRoomPayload: expect.any(Function) }),
    );
    expect(consumer.gameEvents).toBe(gameEvents);
    await expect(
      consumer.gameRooms.getRoomPayload(asRoomId(42)),
    ).resolves.toEqual(
      expect.objectContaining({ room: expect.objectContaining({ id: 42 }) }),
    );
    const onDeleted = () => {};
    consumer.gameEvents.onRoomDeleted(onDeleted);
    expect(gameEvents.onRoomDeleted).toHaveBeenCalledWith(onDeleted);
    await expect(consumer.bots.countBotsForRoom(asRoomId(42))).resolves.toBe(2);
    await consumer.participants.listActiveRoomsByUserIds([42]);
    await consumer.snapshots.deleteOwnedSnapshot('snapshot', asRoomId(42));
    expect(participants.listActiveRoomsByUserIds).toHaveBeenCalledWith([42]);
    expect(snapshots.deleteOwnedSnapshot).toHaveBeenCalledWith(
      'snapshot',
      asRoomId(42),
    );
  } finally {
    await app.close();
  }
});
