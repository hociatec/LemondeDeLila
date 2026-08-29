import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ROOM_VAULT_PORT,
  type RoomVaultPort,
  type RoomVaultRoomRecord,
} from '../../../room/public-api';
import type { VaultRoomSnapshot } from '../../vault.types';
import { VAULT_BOT_PORT, type VaultBotPort } from '../ports/vault-bot.port';
import { VAULT_GAME_PORT, type VaultGamePort } from '../ports/vault-game.port';
import {
  VAULT_PRESENCE_PORT,
  type VaultPresencePort,
} from '../ports/vault-presence.port';
import {
  VAULT_ROOM_SNAPSHOT_REPOSITORY,
  type VaultRoomSnapshotRepository,
} from '../ports/vault-room-snapshot.repository';
import {
  VAULT_USER_NOTIFIER,
  type VaultUserNotifier,
} from '../ports/vault-user-notifier.port';
import { remapVaultGameState } from './vault-game-state-remapper';
import { decodeVaultRoomSnapshot } from './vault-snapshot.decoder';
import { bestEffort } from '../../../common/utils/public-api';

type RosterUser = { id: number; username: string };
type RestoredBots = {
  idMap: Map<number, number>;
  namesByNewId: Map<number, string>;
};

function parseSnapshot(raw: string): VaultRoomSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? ''));
  } catch {
    throw new BadRequestException('Sauvegarde corrompue (JSON invalide).');
  }
  const snapshot = decodeVaultRoomSnapshot(parsed);
  if (!snapshot) {
    throw new BadRequestException('Sauvegarde incompatible.');
  }
  return snapshot;
}

function uniqueUsers(
  users: Array<{ id: number; username?: string }>,
): RosterUser[] {
  const namesById = new Map<number, string>();
  for (const user of users) {
    if (!user || !Number.isFinite(user.id) || user.id <= 0) {
      continue;
    }
    const id = Math.floor(user.id);
    if (!namesById.has(id)) {
      namesById.set(id, String(user.username ?? '').trim() || `joueur ${id}`);
    }
  }
  return Array.from(namesById, ([id, username]) => ({ id, username }));
}

@Injectable()
export class VaultSnapshotRestoreService {
  constructor(
    @Inject(VAULT_ROOM_SNAPSHOT_REPOSITORY)
    private readonly snapshots: VaultRoomSnapshotRepository,
    @Inject(ROOM_VAULT_PORT)
    private readonly rooms: RoomVaultPort,
    @Inject(VAULT_BOT_PORT)
    private readonly bots: VaultBotPort,
    @Inject(VAULT_USER_NOTIFIER)
    private readonly notifier: VaultUserNotifier,
    @Inject(VAULT_GAME_PORT)
    private readonly game: VaultGamePort,
    @Inject(VAULT_PRESENCE_PORT)
    private readonly presence: VaultPresencePort,
  ) {}

  async restore(
    ownerUserId: number,
    snapshotId: string,
  ): Promise<{ roomId: number }> {
    const id = String(snapshotId ?? '').trim();
    if (!id) {
      throw new BadRequestException('id requis');
    }
    const entity = await this.snapshots.findByIdForOwner(id, ownerUserId);
    if (!entity) {
      throw new BadRequestException('Sauvegarde introuvable');
    }
    const snapshot = parseSnapshot(entity.snapshotJson);
    const humans = (snapshot.roster.players ?? []).filter(
      (player) => typeof player?.id === 'number' && player.id > 0,
    );
    if (humans.length === 0) {
      throw new BadRequestException('Sauvegarde invalide : aucun joueur');
    }
    await this.ensureRosterAvailable(ownerUserId, snapshot, humans);
    const room = await this.createRoom(ownerUserId, id, snapshot, humans);
    try {
      const restoredBots = await this.restoreBots(room.id, snapshot);
      await this.restoreAmbience(room.id, ownerUserId, snapshot);
      await this.restoreGame(room.id, ownerUserId, snapshot, restoredBots);
      await this.notifyPlayers(room.id, ownerUserId, snapshot, humans);
      return { roomId: room.id };
    } catch (error) {
      await bestEffort(
        this.rooms.adminDestroyRoom(room.id),
        `compensation restauration vault room=${room.id}`,
      );
      throw error;
    }
  }

  private async ensureRosterAvailable(
    ownerUserId: number,
    snapshot: VaultRoomSnapshot,
    humans: RosterUser[],
  ): Promise<void> {
    const owner = Number(snapshot.roster.ownerUserId);
    const roster = uniqueUsers([
      ...humans,
      ...(Number.isFinite(owner)
        ? [{ id: owner, username: 'proprietaire' }]
        : []),
    ]);
    const absent = roster.filter(
      (player) => !this.presence.isUserInTavern(player.id),
    );
    if (absent.length > 0) {
      throw new BadRequestException(
        `Restauration impossible : joueurs absents de la taverne : ${this.namesOf(absent)}.`,
      );
    }
    const unavailable: RosterUser[] = [];
    for (const player of roster) {
      if (player.id === ownerUserId) {
        continue;
      }
      const activeRoom = await this.rooms.findLatestActiveRoomForUser(
        player.id,
      );
      if (activeRoom?.roomId && activeRoom.roomId > 0) {
        unavailable.push(player);
      }
    }
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `Restauration impossible : joueurs encore en table : ${this.namesOf(unavailable)}.`,
      );
    }
  }

  private async createRoom(
    ownerUserId: number,
    snapshotId: string,
    snapshot: VaultRoomSnapshot,
    humans: RosterUser[],
  ): Promise<RoomVaultRoomRecord> {
    const room = await this.rooms.createRoom(
      ownerUserId,
      snapshot.game.gameType,
      `${snapshot.room.name} (restaurée)`,
      snapshot.room.maxPlayers,
      snapshot.room.isPrivate,
    );
    try {
      const persisted = await this.rooms.requireRoomForOwnerAction(
        room.id,
        ownerUserId,
      );
      persisted.restoredFromSnapshotId = snapshotId;
      persisted.restoredOwnerUserId = ownerUserId;
      await this.rooms.saveRoom(persisted);
    } catch {
      // Best effort: restoring the game can continue without the overwrite link.
    }
    for (const player of humans) {
      if (player.id !== ownerUserId) {
        await this.rooms.joinRoom(room.id, player.id, {
          allowPrivate: snapshot.room.isPrivate,
        });
      }
    }
    return room;
  }

  private async restoreBots(
    roomId: number,
    snapshot: VaultRoomSnapshot,
  ): Promise<RestoredBots> {
    const idMap = new Map<number, number>();
    const namesByNewId = new Map<number, string>();
    for (const oldBot of snapshot.roster.bots ?? []) {
      let added: { id: number };
      try {
        added = await this.bots.addSystemBot(roomId);
      } catch (error) {
        this.throwBotError(error);
      }
      const name = String(oldBot?.name ?? '').trim();
      if (name) {
        try {
          await this.bots.renameBot(added.id, name);
        } catch {
          // Best effort: the restored bot remains usable with its generated name.
        }
      }
      const oldPlayerId = -Math.abs(Number(oldBot.id));
      const newPlayerId = -Math.abs(Number(added.id));
      idMap.set(oldPlayerId, newPlayerId);
      namesByNewId.set(newPlayerId, name || 'Bot');
    }
    return { idMap, namesByNewId };
  }

  private async restoreAmbience(
    roomId: number,
    ownerUserId: number,
    snapshot: VaultRoomSnapshot,
  ): Promise<void> {
    try {
      const room = await this.rooms.requireRoomForOwnerAction(
        roomId,
        ownerUserId,
      );
      room.tableAmbienceSoundId = snapshot.room.tableAmbienceSoundId;
      await this.rooms.saveRoom(room);
      await this.rooms.invalidateRoomPayloadCache(roomId);
    } catch {
      // Best effort: ambience does not prevent state restoration.
    }
  }

  private async restoreGame(
    roomId: number,
    ownerUserId: number,
    snapshot: VaultRoomSnapshot,
    bots: RestoredBots,
  ): Promise<void> {
    const started = await this.rooms.startRoom(roomId, ownerUserId);
    const restoredState = remapVaultGameState(snapshot.game.state, {
      roomId,
      roomOwnerId: ownerUserId,
      roomStartedAt: started.startedAt?.toISOString() ?? null,
      roomRunId: Number.isFinite(started.runId) ? Number(started.runId) : null,
      botIdMap: bots.idMap,
      botNamesByNewId: bots.namesByNewId,
    });
    await this.game.restoreState(roomId, snapshot.game.gameType, restoredState);
  }

  private async notifyPlayers(
    roomId: number,
    ownerUserId: number,
    snapshot: VaultRoomSnapshot,
    humans: RosterUser[],
  ): Promise<void> {
    for (const player of humans) {
      await this.notifier.notifyRoomRestoreReady({
        userId: player.id,
        roomId,
        roomName: `${snapshot.room.name} (restaurée)`,
        ownerUserId,
      });
    }
  }

  private namesOf(users: RosterUser[]): string {
    return users.map((user) => user.username).join(', ');
  }

  private throwBotError(error: unknown): never {
    const message =
      error instanceof Error ? error.message : 'Erreur bot inconnue';
    throw new BadRequestException(message);
  }
}
