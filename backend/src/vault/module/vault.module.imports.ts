import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from '../../bot/public-api';
import { GameModule } from '../../game/public-api';
import { GameRegistryModule } from '../../game/public-api';
import { NotificationModule } from '../../notification/public-api';
import { PresenceModule } from '../../presence/public-api';
import { RoomModule } from '../../room/public-api';
import { VaultRoomSnapshotEntity } from '../infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';

export const VAULT_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([VaultRoomSnapshotEntity]),
  RoomModule,
  BotModule,
  GameRegistryModule,
  GameModule,
  PresenceModule,
  NotificationModule,
];
