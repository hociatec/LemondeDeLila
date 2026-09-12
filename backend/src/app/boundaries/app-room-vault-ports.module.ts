import { Global, Module } from '@nestjs/common';
import { ROOM_VAULT_PORT } from '../../modules/room/public-api';
import { RoomModule } from '../../modules/room/composition-api';
import { VAULT_ROOM_PORT } from '../../modules/vault/public-api';

@Global()
@Module({
  imports: [RoomModule],
  providers: [
    {
      provide: VAULT_ROOM_PORT,
      useExisting: ROOM_VAULT_PORT,
    },
  ],
  exports: [VAULT_ROOM_PORT],
})
export class AppRoomVaultPortsModule {}
