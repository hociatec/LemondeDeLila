import type {
  SessionState,
  SessionStateStore,
} from './session-store.interface';

export class InMemorySessionStore implements SessionStateStore {
  private readonly sessions = new Map<string, SessionState>();

  async save(connectionId: string, state: SessionState): Promise<void> {
    this.sessions.set(connectionId, state);
  }

  async get(connectionId: string): Promise<SessionState | null> {
    return this.sessions.get(connectionId) ?? null;
  }

  async delete(connectionId: string): Promise<void> {
    this.sessions.delete(connectionId);
  }
}
