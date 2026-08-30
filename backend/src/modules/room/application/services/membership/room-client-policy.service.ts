import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../contracts/room-payload.model';
import {
  hasMinimumParticipants,
  resolveMinimumParticipants,
} from '../lifecycle/room-start-policy';

function countUniqueMembers(
  members: Array<{ id: number }> | undefined,
): number {
  return new Set(
    (members ?? [])
      .map((member) => Number(member?.id))
      .filter((id) => Number.isFinite(id) && id > 0),
  ).size;
}

@Injectable()
export class RoomClientPolicyService {
  canSpectate(
    payload: RoomPayload,
    userId: number,
    invitesCanSpectate: boolean | (() => boolean),
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
    if (!started) return false;
    return typeof invitesCanSpectate === 'function'
      ? invitesCanSpectate()
      : invitesCanSpectate;
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
    const humans = countUniqueMembers(room.players);
    const bots = countUniqueMembers(room.bots);
    const minimum = resolveMinimumParticipants(payload.manifest?.minPlayers);
    const maximum =
      Number.isFinite(room.maxPlayers) && room.maxPlayers > 0
        ? Math.trunc(room.maxPlayers)
        : minimum;
    const canStart = !started && hasMinimumParticipants(humans, bots, minimum);

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
      if (canStart) actions.add('room.start');
      actions.add('room.reset');
      actions.add('room.toggle-privacy');
      if (!started && humans + bots < maximum) actions.add('bot.add');
      if (!started && bots > 0) actions.add('bot.remove');
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
/** Room application capability boundary. */
