import { VAULT_BOT_PORT } from '../application/ports/vault-bot.port';
import { VAULT_GAME_PORT } from '../application/ports/vault-game.port';
import { VAULT_PRESENCE_PORT } from '../application/ports/vault-presence.port';
import { VAULT_ROOM_SNAPSHOT_REPOSITORY } from '../application/ports/vault-room-snapshot.repository';
import { VAULT_USER_NOTIFIER } from '../application/ports/vault-user-notifier.port';
import { VaultRoomSnapshotsService } from '../application/services/vault-room-snapshots.service';
import { VaultSnapshotRestoreService } from '../application/services/vault-snapshot-restore.service';
import { VaultSnapshotWriterService } from '../application/services/vault-snapshot-writer.service';
import { VaultRoomSnapshotTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/vault-room-snapshot-typeorm.repository';
import { VaultBotAdapter } from '../infrastructure/system/vault-bot.adapter';
import { VaultGameAdapter } from '../infrastructure/system/vault-game.adapter';
import { VaultPresenceAdapter } from '../infrastructure/system/vault-presence.adapter';
import { VaultUserNotifierAdapter } from '../infrastructure/system/vault-user-notifier.adapter';

export const VAULT_CORE_PROVIDERS = [
  VaultRoomSnapshotTypeormRepository,
  VaultBotAdapter,
  VaultGameAdapter,
  VaultPresenceAdapter,
  VaultUserNotifierAdapter,
  {
    provide: VAULT_BOT_PORT,
    useExisting: VaultBotAdapter,
  },
  {
    provide: VAULT_GAME_PORT,
    useExisting: VaultGameAdapter,
  },
  {
    provide: VAULT_PRESENCE_PORT,
    useExisting: VaultPresenceAdapter,
  },
  {
    provide: VAULT_ROOM_SNAPSHOT_REPOSITORY,
    useExisting: VaultRoomSnapshotTypeormRepository,
  },
  {
    provide: VAULT_USER_NOTIFIER,
    useExisting: VaultUserNotifierAdapter,
  },
  VaultRoomSnapshotsService,
  VaultSnapshotRestoreService,
  VaultSnapshotWriterService,
];
