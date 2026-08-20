import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';
import { RoomService } from '../../room/services/room.service';
import { AddSystemBotToRoomService } from '../../bot/application/use-cases/bot-rooms/add-system-bot-to-room.service';
import { mapBotApplicationError } from '../../bot/infrastructure/errors/bot-error-http.mapper';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { GameEngineService } from '../../game/engine/services/game-engine.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { PresenceService } from '../../presence/services/presence.service';
import { WS_EVENTS } from '../../common/ws/ws-events';
import type { VaultRoomSnapshot } from '../vault.types';
import type { GameStateEntity } from '../../game/core/entities/game-state.entity';

@Injectable()
export class VaultRoomSnapshotsService {
  constructor(
    @InjectRepository(VaultRoomSnapshotEntity)
    private readonly snapshots: Repository<VaultRoomSnapshotEntity>,
    @InjectRepository(RoomBot)
    private readonly roomBots: Repository<RoomBot>,
    private readonly rooms: RoomService,
    private readonly addSystemBotToRoom: AddSystemBotToRoomService,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly notifications: NotificationService,
    private readonly presence: PresenceService,
  ) {}

  async list(ownerUserId: number): Promise<
    Array<{
      id: string;
      name: string;
      roomName: string;
      gameType: string;
      playersLabel: string;
      createdAt: string;
    }>
  > {
    const items = await this.snapshots.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return items.map((s) => ({
      id: s.id,
      name: s.name,
      roomName: s.roomName,
      gameType: s.gameType,
      playersLabel: s.playersLabel,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async delete(ownerUserId: number, snapshotId: string): Promise<boolean> {
    const id = String(snapshotId ?? '').trim();
    if (!id) throw new BadRequestException('id requis');
    const res = await this.snapshots.delete({ id, ownerUserId } as any);
    return (res.affected ?? 0) > 0;
  }

  async save(
    ownerUserId: number,
    roomId: number,
    snapshotId?: string | null,
  ): Promise<{ id: string }> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new BadRequestException('roomId invalide');
    }

    const payload = await this.rooms.getRoomPayload(roomId);
    const isOwner = payload?.room?.owner?.id === ownerUserId;
    const isPlayer = payload?.room?.players?.some((p) => p?.id === ownerUserId);
    if (!isOwner && !isPlayer) {
      throw new BadRequestException("Vous n'êtes pas sur cette table.");
    }
    if (!isOwner) {
      throw new BadRequestException(
        'Seul le propriétaire de la table peut sauvegarder.',
      );
    }
    const started =
      String(payload?.room?.status ?? '').toLowerCase() === 'started' ||
      Boolean(payload?.room?.startedAt);
    if (!started) {
      throw new BadRequestException(
        'Sauvegarde impossible : la partie doit être démarrée.',
      );
    }

    const gameType = String(payload?.room?.gameType ?? '').trim();
    if (!gameType) {
      throw new BadRequestException('Type de jeu invalide');
    }

    const state = await this.engine.exportInternalState(roomId, gameType);
    if (!state) {
      throw new BadRequestException(
        "État de jeu introuvable (la table n'est peut-être pas démarrée).",
      );
    }

    const gameName =
      String(this.registry.getHandler(gameType)?.displayName ?? '').trim() ||
      gameType;

    const dateFr = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());

    const players = (payload.room.players ?? [])
      .map((p) => String(p?.username ?? '').trim())
      .filter((u) => u.length > 0);
    const playersShort =
      players.slice(0, 6).join(', ') + (players.length > 6 ? ', …' : '');

    const name = `${gameName}, ${dateFr} (${playersShort || 'joueurs'})`.slice(
      0,
      200,
    );
    const playersLabel = players.join(', ').slice(0, 255);

    const snapshot: VaultRoomSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      room: {
        name: String(payload.room.name ?? '').trim() || `Table ${gameType}`,
        isPrivate: Boolean(payload.room.isPrivate),
        maxPlayers: Number(payload.room.maxPlayers ?? 4) || 4,
        tableAmbienceSoundId:
          typeof (payload.room as any)?.tableAmbienceSoundId === 'string'
            ? String((payload.room as any).tableAmbienceSoundId).trim() || null
            : null,
      },
      roster: {
        ownerUserId:
          typeof payload.room.owner?.id === 'number'
            ? payload.room.owner.id
            : null,
        players: (payload.room.players ?? []).map((p) => ({
          id: p.id,
          username: p.username,
        })),
        spectators: (payload.room.spectators ?? []).map((s) => ({
          id: s.id,
          username: s.username,
        })),
        bots: (payload.room.bots ?? []).map((b) => ({
          id: b.id,
          name: b.name,
        })),
      },
      game: { gameType, state },
    };

    // If a snapshot id is provided, update it (overwrite) instead of creating a new entry.
    // Also: if the room was created by restoring a snapshot, always overwrite that original snapshot
    // (prevents accidental duplicates if the client doesn't carry the id).
    const requestedIdRaw = String(snapshotId ?? '').trim();
    let requestedId = requestedIdRaw;
    try {
      const room = await this.rooms.requireRoomForOwnerAction(
        roomId,
        ownerUserId,
      );
      const restoredFrom =
        typeof (room as any).restoredFromSnapshotId === 'string'
          ? String((room as any).restoredFromSnapshotId).trim() || ''
          : '';
      const restoredOwner =
        typeof (room as any).restoredOwnerUserId === 'number'
          ? Number((room as any).restoredOwnerUserId)
          : null;
      if (
        !requestedId &&
        restoredFrom &&
        (restoredOwner === ownerUserId || restoredOwner == null)
      ) {
        // Only auto-overwrite if the snapshot exists for this owner.
        // This prevents blocking saves when ownership was transferred to a different user.
        const exists = await this.snapshots.findOne({
          where: { id: restoredFrom, ownerUserId } as any,
          select: ['id'] as any,
        });
        if (exists) {
          requestedId = restoredFrom;
        }
      }
    } catch {
      // best-effort (room may already be closing/deleted)
    }
    let entity: VaultRoomSnapshotEntity;
    if (requestedId) {
      const existing = await this.snapshots.findOne({
        where: { id: requestedId, ownerUserId },
      });
      if (existing) {
        existing.name = name;
        existing.gameType = gameType;
        existing.roomName = snapshot.room.name.slice(0, 255);
        existing.playersLabel = playersLabel;
        existing.snapshotJson = JSON.stringify(snapshot);
        existing.createdAt = new Date();
        entity = await this.snapshots.save(existing);
      } else {
        entity = this.snapshots.create({
          id: randomUUID(),
          ownerUserId,
          name,
          gameType,
          roomName: snapshot.room.name.slice(0, 255),
          playersLabel,
          snapshotJson: JSON.stringify(snapshot),
          createdAt: new Date(),
        });
        await this.snapshots.save(entity);
      }
    } else {
      entity = this.snapshots.create({
        id: randomUUID(),
        ownerUserId,
        name,
        gameType,
        roomName: snapshot.room.name.slice(0, 255),
        playersLabel,
        snapshotJson: JSON.stringify(snapshot),
        createdAt: new Date(),
      });
      await this.snapshots.save(entity);
    }
    // Sauvegarde de table = "archiver et fermer" : tout le monde retourne à la taverne.
    // Le RoomGateway enverra 'room.deleted' à tous les clients connectés.
    await this.rooms.adminDestroyRoom(roomId);

    return { id: entity.id };
  }

  async restore(
    ownerUserId: number,
    snapshotId: string,
  ): Promise<{ roomId: number }> {
    const id = String(snapshotId ?? '').trim();
    if (!id) throw new BadRequestException('id requis');

    const entity = await this.snapshots.findOne({ where: { id, ownerUserId } });
    if (!entity) {
      throw new BadRequestException('Sauvegarde introuvable');
    }

    const snapshot = this.parseSnapshot(entity.snapshotJson);
    const humans = (snapshot.roster.players ?? []).filter(
      (p) => typeof p?.id === 'number' && p.id > 0,
    );
    if (humans.length === 0) {
      throw new BadRequestException('Sauvegarde invalide : aucun joueur');
    }

    const rosterHumans = this.uniqueUsers([
      ...humans,
      ...(Number.isFinite(snapshot.roster.ownerUserId)
        ? [
            {
              id: Number(snapshot.roster.ownerUserId),
              username: 'proprietaire',
            },
          ]
        : []),
    ]);
    const notInTavern = rosterHumans.filter(
      (p) => !this.presence.isUserInTavern(p.id),
    );
    if (notInTavern.length > 0) {
      throw new BadRequestException(
        `Restauration impossible : joueurs absents de la taverne : ${notInTavern
          .map((p) => String(p.username ?? `joueur ${p.id}`))
          .join(', ')}.`,
      );
    }

    const unavailable: string[] = [];
    for (const p of rosterHumans) {
      // The restorer can be "still attached" to a previous room record while
      // already being back in tavern context. We allow restore for that user:
      // createRoom/joinRoom will handle leaving prior rooms safely.
      if (p.id === ownerUserId) continue;
      const activeRoom = await this.rooms.findLatestActiveRoomForUser(p.id);
      if (activeRoom?.roomId && activeRoom.roomId > 0) {
        unavailable.push(String(p.username ?? `joueur ${p.id}`));
      }
    }
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `Restauration impossible : joueurs encore en table : ${unavailable.join(', ')}.`,
      );
    }

    const gameType = snapshot.game.gameType;
    const roomName = snapshot.room.name;

    const created = await this.rooms.createRoom(
      ownerUserId,
      gameType,
      `${roomName} (restaurée)`,
      snapshot.room.maxPlayers,
      snapshot.room.isPrivate,
    );
    // Mark room as "restored from vault" (persisted) so we can clean it up on owner quit.
    try {
      const room = await this.rooms.requireRoomForOwnerAction(
        created.id,
        ownerUserId,
      );
      (room as any).restoredFromSnapshotId = id;
      (room as any).restoredOwnerUserId = ownerUserId;
      await this.rooms.saveRoom(room);
    } catch {
      // best-effort
    }

    // Join all other human players.
    for (const p of humans) {
      if (p.id === ownerUserId) continue;
      await this.rooms.joinRoom(created.id, p.id, {
        allowPrivate: snapshot.room.isPrivate,
      });
    }

    // Recreate bots + build id mapping.
    const oldBots = snapshot.roster.bots ?? [];
    const botIdMap = new Map<number, number>();
    for (const b of oldBots) {
      let added;
      try {
        added = await this.addSystemBotToRoom.execute(created.id);
      } catch (error) {
        throw mapBotApplicationError(error);
      }
      // Preserve names when possible.
      try {
        const desired = String(b?.name ?? '').trim();
        if (desired) {
          (added as any).name = desired;
          await this.roomBots.save(added as any);
        }
      } catch {
        // best-effort
      }
      const oldPlayerId = -Math.abs(Number(b.id));
      const newPlayerId = -Math.abs(Number(added.id));
      botIdMap.set(oldPlayerId, newPlayerId);
    }

    // Restore table ambience.
    try {
      const room = await this.rooms.requireRoomForOwnerAction(
        created.id,
        ownerUserId,
      );
      (room as any).tableAmbienceSoundId = snapshot.room.tableAmbienceSoundId;
      await this.rooms.saveRoom(room);
      await this.rooms.invalidateRoomPayloadCache(created.id);
    } catch {
      // best-effort
    }

    // Start room (sets startedAt + runId).
    const started = await this.rooms.startRoom(created.id, ownerUserId);
    const startedAt = started.startedAt
      ? started.startedAt.toISOString()
      : null;
    const runId = Number.isFinite((started as any).runId)
      ? (started as any).runId
      : null;

    const restored = this.remapState(snapshot.game.state, {
      roomId: created.id,
      roomOwnerId: ownerUserId,
      roomStartedAt: startedAt,
      roomRunId: runId,
      botIdMap,
      botNamesByNewId: new Map(
        Array.from(botIdMap.entries()).map(([_, newId]) => {
          const old = oldBots.find((b) => -Math.abs(Number(b.id)) === _);
          return [newId, old?.name ?? 'Bot'];
        }),
      ),
    });

    await this.engine.restoreInternalState(created.id, gameType, restored);

    // Note: la sauvegarde reste visible dans le coffre après restauration.
    // Elle sera écrasée si la table restaurée est re-sauvegardée, ou supprimée
    // si la table restaurée est abandonnée/réinitialisée.

    // Notify players to open the restored table.
    for (const p of humans) {
      await this.notifications.notifyUser(p.id, WS_EVENTS.room.restoreReady, {
        roomId: created.id,
        roomName: `${roomName} (restaurée)`,
        by: { id: ownerUserId },
      });
    }

    return { roomId: created.id };
  }

  /**
   * Supprime une table créée via restauration et sa sauvegarde liée.
   * Utilisé quand le propriétaire quitte la table (Q) sans la re-sauvegarder.
   */
  async abandonRestoredRoom(
    ownerUserId: number,
    roomId: number,
  ): Promise<boolean> {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide');
    }

    let snapshotId: string | null = null;
    try {
      const room = await this.rooms.requireRoomForOwnerAction(id, ownerUserId);
      snapshotId =
        typeof (room as any).restoredFromSnapshotId === 'string'
          ? String((room as any).restoredFromSnapshotId).trim() || null
          : null;
      const restoredOwner =
        typeof (room as any).restoredOwnerUserId === 'number'
          ? Number((room as any).restoredOwnerUserId)
          : null;
      if (!snapshotId || restoredOwner !== ownerUserId) {
        return false;
      }
    } catch {
      return false;
    }

    try {
      await this.rooms.adminDestroyRoom(id);
    } catch {
      return false;
    }

    try {
      await this.snapshots.delete({ id: snapshotId, ownerUserId } as any);
    } catch {
      return false;
    }

    return true;
  }

  private parseSnapshot(raw: string): VaultRoomSnapshot {
    let parsed: any;
    try {
      parsed = JSON.parse(String(raw ?? ''));
    } catch {
      throw new BadRequestException('Sauvegarde corrompue (JSON invalide).');
    }
    if (!parsed || parsed.version !== 1) {
      throw new BadRequestException('Sauvegarde incompatible.');
    }
    return parsed as VaultRoomSnapshot;
  }

  private remapState(
    state: GameStateEntity,
    opts: {
      roomId: number;
      roomOwnerId: number;
      roomStartedAt: string | null;
      roomRunId: number | null;
      botIdMap: Map<number, number>;
      botNamesByNewId: Map<number, string>;
    },
  ): GameStateEntity {
    const replaceId = (value: any): any => {
      if (typeof value === 'number' && opts.botIdMap.has(value)) {
        return opts.botIdMap.get(value);
      }
      return value;
    };

    const deep = (value: any): any => {
      if (value == null) return value;
      if (typeof value === 'number') return replaceId(value);
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value;
      if (Array.isArray(value)) return value.map(deep);
      if (typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) {
          const maybeId = Number(k);
          const key =
            Number.isFinite(maybeId) && opts.botIdMap.has(maybeId)
              ? String(opts.botIdMap.get(maybeId))
              : k;
          out[key] = deep(v);
        }
        return out;
      }
      return value;
    };

    const cloned = deep(state) as GameStateEntity;
    cloned.status = 'started';
    if (Array.isArray((state as any)?.log)) {
      (cloned as any).log = deep((state as any).log);
    }

    // Patch core metadata.
    const meta: any =
      typeof cloned.metadata === 'object' && cloned.metadata
        ? cloned.metadata
        : {};
    meta.roomId = opts.roomId;
    meta.roomOwnerId = opts.roomOwnerId;
    meta.roomStartedAt = opts.roomStartedAt;
    meta.roomRunId = opts.roomRunId;
    cloned.metadata = meta;

    // Patch players list: update bot ids + names.
    if (Array.isArray(cloned.players)) {
      cloned.players = cloned.players.map((p: any) => {
        const nextId = typeof p?.id === 'number' ? replaceId(p.id) : p?.id;
        const nextName =
          typeof nextId === 'number' &&
          nextId < 0 &&
          opts.botNamesByNewId.has(nextId)
            ? opts.botNamesByNewId.get(nextId)
            : p?.username;
        return { ...p, id: nextId, username: nextName };
      });
    }

    if (cloned.turn && typeof cloned.turn.currentPlayerId === 'number') {
      cloned.turn = {
        ...cloned.turn,
        currentPlayerId: replaceId(cloned.turn.currentPlayerId),
      };
    }

    return cloned;
  }

  private uniqueUsers(
    users: Array<{ id: number; username?: string }>,
  ): Array<{ id: number; username: string }> {
    const map = new Map<number, string>();
    for (const user of users) {
      if (!user || !Number.isFinite(user.id) || user.id <= 0) continue;
      const id = Math.floor(user.id);
      if (map.has(id)) continue;
      const username = String(user.username ?? '').trim();
      map.set(id, username || `joueur ${id}`);
    }
    return Array.from(map.entries()).map(([id, username]) => ({
      id,
      username,
    }));
  }
}
