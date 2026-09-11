import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { operationalSettings } from '../../../../../platform/config/public-api';

export type RoomInvite = {
  id: string;
  roomId: number;
  fromUserId: number;
  toUserId: number;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number | null;
};

@Injectable()
export class RoomInviteService {
  private static readonly MAX_INVITES = 10_000;
  private static readonly MAX_INVITE_ID_LENGTH = 64;
  constructor(@Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock) {}

  private readonly invites = new Map<string, RoomInvite>();
  private readonly ttlMs = operationalSettings.roomInviteTtlMs;

  create(roomId: number, fromUserId: number, toUserId: number): RoomInvite {
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
    this.cleanupExpired(now);
    this.enforceBound();
    const invite: RoomInvite = {
      id: randomUUID(),
      roomId,
      fromUserId,
      toUserId,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      consumedAt: null,
    };
    this.invites.set(invite.id, invite);
    return { ...invite };
  }

  get(id: string): RoomInvite | null {
    if (typeof id !== 'string' || id.length === 0 || id.length > RoomInviteService.MAX_INVITE_ID_LENGTH) {
      return null;
    }
    const invite = this.invites.get(id) ?? null;
    if (!invite) return null;
    if (invite.expiresAt <= this.clock.now()) {
      this.invites.delete(id);
      return null;
    }
    return { ...invite };
  }

  findActive(roomId: number, toUserId: number): RoomInvite | null {
    this.cleanupExpired();
    for (const invite of this.invites.values()) {
      if (
        invite.roomId === roomId &&
        invite.toUserId === toUserId &&
        invite.consumedAt == null
      ) {
        return { ...invite };
      }
    }
    return null;
  }

  /**
   * "Consomme" une invitation. Par défaut on la supprime (one-shot).
   * Si `keep=true`, on la garde jusqu'à expiration pour autoriser une connexion
   * immédiate (ex: spectateur sur table privée déjà démarrée).
   */
  consume(id: string, opts?: { keep?: boolean }): RoomInvite | null {
    const invite = this.get(id);
    if (!invite) return null;
    const keep = opts?.keep === true;
    if (!keep) {
      this.invites.delete(id);
      return invite;
    }
    invite.consumedAt = this.clock.now();
    this.invites.set(invite.id, invite);
    return { ...invite };
  }

  delete(id: string) {
    this.invites.delete(id);
  }

  canSpectate(roomId: number, userId: number): boolean {
    this.cleanupExpired();
    for (const invite of this.invites.values()) {
      if (
        invite.roomId === roomId &&
        invite.toUserId === userId &&
        invite.consumedAt != null
      ) {
        return true;
      }
    }
    return false;
  }

  private cleanupExpired(now = this.clock.now()) {
    for (const [id, invite] of this.invites.entries()) {
      if (invite.expiresAt <= now) {
        this.invites.delete(id);
      }
    }
  }

  private enforceBound(): void {
    while (this.invites.size >= RoomInviteService.MAX_INVITES) {
      const oldest = this.invites.keys().next().value;
      if (typeof oldest !== 'string') return;
      this.invites.delete(oldest);
    }
  }
}
/** Room application capability boundary. */
