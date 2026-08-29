import type { PresencePublicPlayer } from '../services/presence-state.utils';

export type PresenceEvent = {
  players: PresencePublicPlayer[];
  origin: string | null;
  at?: number;
};

export abstract class PresenceTransport {
  abstract connect(): Promise<void>;
  abstract publish(event: PresenceEvent): Promise<void>;
  abstract subscribe(handler: (event: PresenceEvent) => void): Promise<void>;
  abstract disconnect(): Promise<void>;
}
