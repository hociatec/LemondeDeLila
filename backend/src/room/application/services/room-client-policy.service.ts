import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../models/room-payload.model';

@Injectable()
export class RoomClientPolicyService {
  canSpectate(
    payload: RoomPayload,
    userId: number,
    invitesCanSpectate: boolean,
  ): boolean {
    if (!payload?.room) {
      return false;
    }
    if (!payload.room.isPrivate) {
      return true;
    }

    const isOwner = payload.room.owner?.id === userId;
    const isParticipant =
      payload.room.players?.some((player) => player?.id === userId) ?? false;
    if (isOwner || isParticipant) {
      return true;
    }

    const started =
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    return started && invitesCanSpectate;
  }

  listAllowedActions(payload: RoomPayload, userId: number): string[] {
    const room = payload.room;
    const started =
      (room.status || '').toLowerCase() === 'started' ||
      Boolean(room.startedAt);
    const isOwner = room.owner?.id === userId;
    const isParticipant =
      room.players?.some((player) => player?.id === userId) ?? false;
    const canToggleRole =
      !started && (!room.isPrivate || isOwner || isParticipant);

    const actions = new Set<string>([
      'room.rules',
      'room.info',
      'room.players',
      'room.leave',
      'room.tableAmbienceVolume',
    ]);

    if (canToggleRole) {
      actions.add('room.set-role');
    }

    if (isOwner) {
      actions.add('room.start');
      actions.add('room.reset');
      actions.add('room.toggle-privacy');
      actions.add('bot.add');
      actions.add('bot.remove');
      actions.add('room.kick');
      actions.add('room.ban');
      actions.add('room.set-owner');
      actions.add('room.set-ambience');
      actions.add('room.tableAmbience');
      actions.add('room.snapshot.save');
    }

    return Array.from(actions);
  }

  shouldReleaseSeatWhileSpectating(
    payload: RoomPayload,
    userId: number,
  ): boolean {
    const started =
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    const isOwner = payload.room.owner?.id === userId;
    return !started && (!payload.room.isPrivate || isOwner);
  }

  canFallbackParticipantToSpectator(
    payload: RoomPayload,
    userId: number,
  ): boolean {
    const isOwner = payload.room.owner?.id === userId;
    const isParticipant =
      payload.room.players?.some((player) => player?.id === userId) ?? false;
    if (isOwner || isParticipant) {
      return false;
    }

    const started =
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    return started || !payload.room.isPrivate;
  }

  requiresSpectateValidationForJoinFallback(
    payload: RoomPayload,
    userId: number,
  ): boolean {
    const isOwner = payload.room.owner?.id === userId;
    const isParticipant =
      payload.room.players?.some((player) => player?.id === userId) ?? false;
    if (isOwner || isParticipant) {
      return false;
    }

    return (
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt)
    );
  }
}
