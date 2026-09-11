import { Global, Module } from '@nestjs/common';
import { OWNED_SNAPSHOT_DELETER } from '../../modules/vault/public-api';
import { VaultModule } from '../../modules/vault/composition-api';
import { ROOM_VAULT_SNAPSHOT_REPOSITORY } from '../../modules/room/composition-api';

@Global()
@Module({
  imports: [VaultModule],
  providers: [
    {
      provide: ROOM_VAULT_SNAPSHOT_REPOSITORY,
      useExisting: OWNED_SNAPSHOT_DELETER,
    },
  ],
  exports: [ROOM_VAULT_SNAPSHOT_REPOSITORY],
})
export class AppVaultPortsModule {}
