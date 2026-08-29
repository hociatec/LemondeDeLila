import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { operationalPolicy } from '../../../../platform/config/public-api';

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
  private readonly invites = new Map<string, RoomInvite>();
  private readonly ttlMs = operationalPolicy.roomInviteTtlMs;

  create(roomId: number, fromUserId: number, toUserId: number): RoomInvite {
    this.cleanupExpired();
    const invite: RoomInvite = {
      id: randomUUID(),
      roomId,
      fromUserId,
      toUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      consumedAt: null,
    };
    this.invites.set(invite.id, invite);
    return invite;
  }

  get(id: string): RoomInvite | null {
    const invite = this.invites.get(id) ?? null;
    if (!invite) return null;
    if (invite.expiresAt <= Date.now()) {
      this.invites.delete(id);
      return null;
    }
    return invite;
  }

  findActive(roomId: number, toUserId: number): RoomInvite | null {
    this.cleanupExpired();
    for (const invite of this.invites.values()) {
      if (
        invite.roomId === roomId &&
        invite.toUserId === toUserId &&
        !invite.consumedAt
      ) {
        return invite;
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
    invite.consumedAt = Date.now();
    this.invites.set(invite.id, invite);
    return invite;
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
        Boolean(invite.consumedAt)
      ) {
        return true;
      }
    }
    return false;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [id, invite] of this.invites.entries()) {
      if (invite.expiresAt <= now) {
        this.invites.delete(id);
      }
    }
  }
}
