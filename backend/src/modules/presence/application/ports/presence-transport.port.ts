import type { PresencePublicPlayer } from '../services/presence-state.utils';

/** Every admitted local player must fit in one complete origin snapshot. */
export const MAX_PRESENCE_PLAYERS_PER_ORIGIN = 1_000;

export type PresenceEvent = {
  players: PresencePublicPlayer[];
  origin: string | null;
  at?: number;
  /** Monotonically increasing within the process identified by origin. */
  sequence?: number;
};

export abstract class PresenceTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: PresenceEvent): Promise<void>;
  abstract subscribe(handler: (event: PresenceEvent) => void): Promise<void>;
  abstract disconnect(): Promise<void>;
}
