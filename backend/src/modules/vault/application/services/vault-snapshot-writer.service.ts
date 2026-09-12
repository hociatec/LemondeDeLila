import type { VaultRoomSnapshotSource } from '../contracts/vault-room-snapshot-source';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VAULT_ROOM_PORT, type VaultRoomPort } from '../ports/vault-room.port';
import type { VaultRoomSnapshotRecord } from '../models/vault-room-snapshot.model';
import type { VaultGameState } from '../models/vault-game-state.model';
import { VAULT_GAME_PORT, type VaultGamePort } from '../ports/vault-game.port';
import {
  VAULT_ROOM_SNAPSHOT_REPOSITORY,
  type VaultRoomSnapshotRepository,
} from '../ports/vault-room-snapshot.repository';
import type { VaultRoomSnapshot } from '../../vault.types';
import {
  businessMsToDate,
  businessMsToIso,
} from '../../../../shared/utils/public-api';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';

type PreparedSnapshot = {
  snapshot: VaultRoomSnapshot;
  name: string;
  gameType: string;
  playersLabel: string;
};

function buildSnapshot(
  payload: VaultRoomSnapshotSource,
  gameType: string,
  state: VaultGameState,
  savedAt: string,
): VaultRoomSnapshot {
  const room = payload.room;
  const ambience = room.tableAmbienceSoundId;
  return {
    version: 1,
    savedAt,
    room: {
      name:
        String(room.name ?? '')
          .trim()
          .slice(0, 255) || `Table ${gameType}`,
      isPrivate: Boolean(room.isPrivate),
      maxPlayers:
        Number.isSafeInteger(room.maxPlayers) &&
        room.maxPlayers >= 1 &&
        room.maxPlayers <= 64
          ? room.maxPlayers
          : 4,
      tableAmbienceSoundId:
        typeof ambience === 'string' ? ambience.trim() || null : null,
    },
    roster: {
      ownerUserId: typeof room.owner?.id === 'number' ? room.owner.id : null,
      players: (room.players ?? []).map((player) => ({
        id: player.id,
        username: String(player.username ?? '')
          .trim()
          .slice(0, 255),
      })),
      spectators: (room.spectators ?? []).map((spectator) => ({
        id: spectator.id,
        username: String(spectator.username ?? '')
          .trim()
          .slice(0, 255),
      })),
      bots: (room.bots ?? []).map((bot) => ({
        id: bot.id,
        name: String(bot.name ?? '')
          .trim()
          .slice(0, 255),
      })),
    },
    game: { gameType, state },
  };
}

@Injectable()
export class VaultSnapshotWriterService {
  private static readonly MAX_SNAPSHOTS_PER_OWNER = 50;
  private static readonly MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
  constructor(
    @Inject(VAULT_ROOM_SNAPSHOT_REPOSITORY)
    private readonly snapshots: VaultRoomSnapshotRepository,
    @Inject(VAULT_ROOM_PORT)
    private readonly rooms: Pick<
      VaultRoomPort,
      'adminDestroyRoom' | 'getRoomPayload' | 'requireRoomForOwnerAction'
    >,
    @Inject(VAULT_GAME_PORT)
    private readonly game: VaultGamePort,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async save(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<{ id: string }> {
    if (
      !Number.isSafeInteger(ownerUserId) ||
      ownerUserId <= 0 ||
      !Number.isSafeInteger(roomId) ||
      roomId <= 0
    ) {
      throw new BadRequestException('roomId invalide');
    }
    const prepared = await this.prepare(ownerUserId, roomId);
    const requestedId = await this.resolveRequestedId(
      ownerUserId,
      roomId,
      snapshotId,
    );
    const entity = await this.persist(ownerUserId, requestedId, prepared);
    await this.rooms.adminDestroyRoom(roomId);
    return { id: entity.id };
  }

  private async prepare(
    ownerUserId: number,
    roomId: number,
  ): Promise<PreparedSnapshot> {
    await this.rooms.requireRoomForOwnerAction(roomId, ownerUserId);
    const payload = await this.rooms.getRoomPayload(roomId);
    const started =
      String(payload.room.status ?? '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    if (!started) {
      throw new BadRequestException(
        'Sauvegarde impossible : la partie doit être démarrée.',
      );
    }
    const gameType = String(payload.room.gameType ?? '').trim();
    if (!gameType) {
      throw new BadRequestException('Type de jeu invalide');
    }
    const state = await this.game.exportState(roomId, gameType);
    if (!state) {
      throw new BadRequestException(
        "État de jeu introuvable (la table n'est peut-être pas démarrée).",
      );
    }
    const snapshot = buildSnapshot(
      payload,
      gameType,
      state,
      businessMsToIso(this.clock.now()),
    );
    const playersLabel = (payload.room.players ?? [])
      .map((player) => String(player?.username ?? '').trim())
      .filter(Boolean)
      .join(', ')
      .slice(0, 255);
    return {
      snapshot,
      gameType,
      playersLabel,
      name: (this.game.getDisplayName(gameType) ?? gameType).slice(0, 200),
    };
  }

  private async resolveRequestedId(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<string> {
    const explicitId = String(snapshotId ?? '').trim();
    if (explicitId.length > 128) {
      throw new BadRequestException('snapshotId invalide');
    }
    if (explicitId) {
      return explicitId;
    }
    try {
      const room = await this.rooms.requireRoomForOwnerAction(
        roomId,
        ownerUserId,
      );
      const restoredId = String(room.restoredFromSnapshotId ?? '').trim();
      const sameOwner =
        room.restoredOwnerUserId === ownerUserId ||
        room.restoredOwnerUserId == null;
      if (
        restoredId &&
        sameOwner &&
        (await this.snapshots.existsByIdForOwner(restoredId, ownerUserId))
      ) {
        return restoredId;
      }
    } catch {
      // Best effort: the room can already be closing.
    }
    return '';
  }

  private async persist(
    ownerUserId: number,
    requestedId: string,
    prepared: PreparedSnapshot,
  ): Promise<VaultRoomSnapshotRecord> {
    const existing = requestedId
      ? await this.snapshots.findByIdForOwner(requestedId, ownerUserId)
      : null;
    const snapshotJson = JSON.stringify(prepared.snapshot);
    if (
      Buffer.byteLength(snapshotJson, 'utf8') >
      VaultSnapshotWriterService.MAX_SNAPSHOT_BYTES
    ) {
      throw new PayloadTooLargeException('Snapshot de partie trop volumineux.');
    }
    const data = {
      name: prepared.name,
      gameType: prepared.gameType,
      roomName: prepared.snapshot.room.name.slice(0, 255),
      playersLabel: prepared.playersLabel,
      snapshotJson,
      createdAt: businessMsToDate(this.clock.now()),
    };
    if (existing) {
      Object.assign(existing, data);
      return this.snapshots.save(existing);
    }
    const current = await this.snapshots.listByOwner(
      ownerUserId,
      VaultSnapshotWriterService.MAX_SNAPSHOTS_PER_OWNER,
    );
    if (current.length >= VaultSnapshotWriterService.MAX_SNAPSHOTS_PER_OWNER) {
      throw new ConflictException(
        `Quota de ${VaultSnapshotWriterService.MAX_SNAPSHOTS_PER_OWNER} snapshots atteint.`,
      );
    }
    const created = this.snapshots.create({
      ...data,
      id: randomUUID(),
      ownerUserId,
    });
    return this.snapshots.save(created);
  }
}
