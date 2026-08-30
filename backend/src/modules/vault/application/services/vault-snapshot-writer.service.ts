import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ROOM_VAULT_PORT,
  type RoomPayload,
  type RoomVaultPort,
} from '../../../room/public-api';
import type { VaultRoomSnapshotRecord } from '../contracts/vault-room-snapshot.model';
import type { VaultGameState } from '../contracts/vault-game-state.model';
import { VAULT_GAME_PORT, type VaultGamePort } from '../ports/vault-game.port';
import {
  VAULT_ROOM_SNAPSHOT_REPOSITORY,
  type VaultRoomSnapshotRepository,
} from '../ports/vault-room-snapshot.repository';
import type { VaultRoomSnapshot } from '../../vault.types';

type VaultRoomPayloadLike = {
  tableAmbienceSoundId?: unknown;
};

type PreparedSnapshot = {
  snapshot: VaultRoomSnapshot;
  name: string;
  gameType: string;
  playersLabel: string;
};

function buildSnapshot(
  payload: RoomPayload,
  gameType: string,
  state: VaultGameState,
): VaultRoomSnapshot {
  const room = payload.room;
  const ambience = (room as VaultRoomPayloadLike).tableAmbienceSoundId;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    room: {
      name: String(room.name ?? '').trim() || `Table ${gameType}`,
      isPrivate: Boolean(room.isPrivate),
      maxPlayers: Number(room.maxPlayers ?? 4) || 4,
      tableAmbienceSoundId:
        typeof ambience === 'string' ? ambience.trim() || null : null,
    },
    roster: {
      ownerUserId: typeof room.owner?.id === 'number' ? room.owner.id : null,
      players: (room.players ?? []).map((player) => ({
        id: player.id,
        username: player.username,
      })),
      spectators: (room.spectators ?? []).map((spectator) => ({
        id: spectator.id,
        username: spectator.username,
      })),
      bots: (room.bots ?? []).map((bot) => ({
        id: bot.id,
        name: bot.name,
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
    @Inject(ROOM_VAULT_PORT)
    private readonly rooms: RoomVaultPort,
    @Inject(VAULT_GAME_PORT)
    private readonly game: VaultGamePort,
  ) {}

  async save(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<{ id: string }> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
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
    const payload = await this.rooms.getRoomPayload(roomId);
    const isOwner = payload?.room?.owner?.id === ownerUserId;
    const isPlayer = payload?.room?.players?.some(
      (player) => player?.id === ownerUserId,
    );
    if (!isOwner && !isPlayer) {
      throw new BadRequestException("Vous n'êtes pas sur cette table.");
    }
    if (!isOwner) {
      throw new BadRequestException(
        'Seul le propriétaire de la table peut sauvegarder.',
      );
    }
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
    const snapshot = buildSnapshot(payload, gameType, state);
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
      createdAt: new Date(),
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
