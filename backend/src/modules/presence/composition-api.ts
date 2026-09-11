/** Nest composition entry; application consumers use public-api. */
export { PresenceModule } from './module/presence.module';
export {
  PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
  type PresenceRoomParticipantRepository,
} from './application/ports/presence-room-participant.repository';
