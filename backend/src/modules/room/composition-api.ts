/** Nest composition entry; application consumers use public-api. */
export { RoomModule } from './module/room.module';
export {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from './application/ports/room-vault-snapshot.repository';
export {
  ROOM_BOTS_REPOSITORY,
  type RoomBotsRepository,
} from './application/ports/room-bots.repository';
