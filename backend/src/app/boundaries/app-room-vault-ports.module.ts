import { Global, Module } from '@nestjs/common';
import {
  ROOM_VAULT_PORT,
  type RoomVaultPort,
} from '../../modules/room/public-api';
import { RoomModule } from '../../modules/room/composition-api';
import {
  VAULT_ROOM_PORT,
  type VaultRoomPort,
} from '../../modules/vault/public-api';

@Global()
@Module({
  imports: [RoomModule],
  providers: [
    {
      provide: VAULT_ROOM_PORT,
      inject: [ROOM_VAULT_PORT],
      useFactory: (rooms: RoomVaultPort): VaultRoomPort => rooms,
    },
  ],
  exports: [VAULT_ROOM_PORT],
})
export class AppRoomVaultPortsModule {}
