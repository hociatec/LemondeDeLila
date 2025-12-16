import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type RoomInvite = {
  id: string;
  roomId: number;
  fromUserId: number;
  toUserId: number;
  createdAt: number;
  expiresAt: number;
};

@Injectable()
export class RoomInviteService {
  private readonly invites = new Map<string, RoomInvite>();
  private readonly ttlMs = 10 * 60 * 1000; // 10 minutes

  create(roomId: number, fromUserId: number, toUserId: number): RoomInvite {
    this.cleanupExpired();
    const invite: RoomInvite = {
      id: randomUUID(),
      roomId,
      fromUserId,
      toUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
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
      if (invite.roomId === roomId && invite.toUserId === toUserId) {
        return invite;
      }
    }
    return null;
  }

  consume(id: string): RoomInvite | null {
    const invite = this.get(id);
    if (!invite) return null;
    this.invites.delete(id);
    return invite;
  }

  delete(id: string) {
    this.invites.delete(id);
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

