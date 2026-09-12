import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { operationalSettings } from '../../../../../platform/config/public-api';
import type { RoomInvite } from '../../models/room-invite.model';
import {
  ROOM_INVITE_REPOSITORY,
  type RoomInviteRepository,
} from '../../ports/room-invite.repository';

export type { RoomInvite } from '../../models/room-invite.model';

@Injectable()
export class RoomInviteService {
  private static readonly MAX_INVITE_ID_LENGTH = 64;
  constructor(
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
    @Inject(ROOM_INVITE_REPOSITORY)
    private readonly invites: RoomInviteRepository,
  ) {}
  private readonly ttlMs = operationalSettings.roomInviteTtlMs;

  async create(
    roomId: number,
    fromUserId: number,
    toUserId: number,
  ): Promise<RoomInvite> {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !Number.isSafeInteger(fromUserId) ||
      fromUserId <= 0 ||
      !Number.isSafeInteger(toUserId) ||
      toUserId <= 0
    ) {
      throw new RangeError('Identifiant d’invitation invalide');
    }
    const now = this.clock.now();
    await this.invites.deleteExpired(now, 1_000);
    const invite: RoomInvite = {
      id: randomUUID(),
      roomId,
      fromUserId,
      toUserId,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      consumedAt: null,
    };
    await this.invites.save(invite);
    return { ...invite };
  }

  get(id: string): Promise<RoomInvite | null> {
    if (
      typeof id !== 'string' ||
      id.length === 0 ||
      id.length > RoomInviteService.MAX_INVITE_ID_LENGTH
    ) {
      return Promise.resolve(null);
    }
    return this.invites.findValidById(id, this.clock.now());
  }

  findActive(roomId: number, toUserId: number): Promise<RoomInvite | null> {
    return this.invites.findActive(roomId, toUserId, this.clock.now());
  }

  activeRecipientIds(
    roomId: number,
    userIds: readonly number[],
  ): Promise<number[]> {
    const safeIds = [...new Set(userIds)].filter(
      (id) => Number.isSafeInteger(id) && id > 0,
    );
    if (safeIds.length === 0) return Promise.resolve([]);
    return this.invites.findActiveRecipientIds(
      roomId,
      safeIds.slice(0, 1_000),
      this.clock.now(),
    );
  }

  /**
   * "Consomme" une invitation. Par défaut on la supprime (one-shot).
   * Si `keep=true`, on la garde jusqu'à expiration pour autoriser une connexion
   * immédiate (ex: spectateur sur table privée déjà démarrée).
   */
  async consume(
    id: string,
    opts?: { keep?: boolean },
  ): Promise<RoomInvite | null> {
    const keep = opts?.keep === true;
    const now = this.clock.now();
    return this.invites.consume(id, now, now, keep);
  }

  delete(id: string): Promise<void> {
    return typeof id === 'string' &&
      id.length <= RoomInviteService.MAX_INVITE_ID_LENGTH
      ? this.invites.delete(id)
      : Promise.resolve();
  }

  canSpectate(roomId: number, userId: number): Promise<boolean> {
    return this.invites.canSpectate(roomId, userId, this.clock.now());
  }
}
/** Room application capability boundary. */
