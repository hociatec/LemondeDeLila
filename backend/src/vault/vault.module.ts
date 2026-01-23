import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultRoomSnapshotEntity } from './entities/vault-room-snapshot.entity';
import { VaultRoomSnapshotsService } from './services/vault-room-snapshots.service';
import { VaultWsHandler } from './ws/vault-ws.handler';
import { VaultWsRegistrar } from './ws/vault-ws.registrar';
import { RoomModule } from '../room/room.module';
import { BotModule } from '../bot/bot.module';
import { GameModule } from '../game/game.module';
import { PresenceModule } from '../presence/presence.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomBot } from '../room/entities/room-bot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaultRoomSnapshotEntity, RoomBot]),
    RoomModule,
    BotModule,
    GameModule,
    PresenceModule,
    NotificationModule,
  ],
  providers: [VaultRoomSnapshotsService, VaultWsHandler, VaultWsRegistrar],
  exports: [VaultRoomSnapshotsService],
})
export class VaultModule {}
