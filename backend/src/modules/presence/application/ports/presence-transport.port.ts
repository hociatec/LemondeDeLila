import type { PresencePublicPlayer } from '../models/presence.models';

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
