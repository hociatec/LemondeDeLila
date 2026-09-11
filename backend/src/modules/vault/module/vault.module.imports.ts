import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from '../../bot/composition-api';
import { GameModule } from '../../../game/composition-api';
import { GameRegistryModule } from '../../../game/composition-api';
import { NotificationModule } from '../../notification/composition-api';
import { PresenceModule } from '../../presence/composition-api';
import { VaultRoomSnapshotEntity } from '../infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';

export const VAULT_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([VaultRoomSnapshotEntity]),
  BotModule,
  GameRegistryModule,
  GameModule,
  PresenceModule,
  NotificationModule,
];
