import { Injectable } from '@nestjs/common';
import type { RoomPayload } from '../../models/room-payload.model';
import { resolveRoomLifecycleState } from '../../models/room-lifecycle-state.model';
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
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  ).size;
}

@Injectable()
export class RoomClientPolicyService {
  spectatorAccess(
    payload: RoomPayload,
    userId: number,
  ): 'allow' | 'deny' | 'invitation' {
    if (!payload?.room) {
      return 'deny';
    }
    if (!payload.room.isPrivate) {
      return 'allow';
    }

    const isOwner = payload.room.owner?.id === userId;
    const isParticipant =
      payload.room.players?.some((player) => player?.id === userId) ?? false;
    if (isOwner || isParticipant) {
      return 'allow';
    }

    const started = resolveRoomLifecycleState(payload.room).kind === 'started';
    return started ? 'invitation' : 'deny';
  }

  listAllowedActions(payload: RoomPayload, userId: number): string[] {
    const room = payload.room;
    const started = resolveRoomLifecycleState(room).kind === 'started';
    const isOwner = room.owner?.id === userId;
    const isParticipant =
      room.players?.some((player) => player?.id === userId) ?? false;
    const canToggleRole =
      !started && (!room.isPrivate || isOwner || isParticipant);
    const humans = countUniqueMembers(room.players);
    const bots = countUniqueMembers(room.bots);
    const minimum = resolveMinimumParticipants(payload.manifest?.minPlayers);
    const maximum =
      Number.isSafeInteger(room.maxPlayers) && room.maxPlayers > 0
        ? Math.min(64, room.maxPlayers)
        : minimum;
    const canStart = !started && hasMinimumParticipants(humans, bots, minimum);

    const actions = new Set<string>(['room.leave']);

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
      actions.add('room.invite');
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
    const started = resolveRoomLifecycleState(payload.room).kind === 'started';
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

    const started = resolveRoomLifecycleState(payload.room).kind === 'started';
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

    return resolveRoomLifecycleState(payload.room).kind === 'started';
  }
}
/** Room application capability boundary. */
