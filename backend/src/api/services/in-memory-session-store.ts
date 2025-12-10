import { SessionState, SessionStateStore } from './session-store.interface';

export class InMemorySessionStore implements SessionStateStore {
  private readonly store = new Map<string, SessionState>();

  async save(connectionId: string, state: SessionState): Promise<void> {
    this.store.set(connectionId, state);
  }

  async get(connectionId: string): Promise<SessionState | null> {
    return this.store.get(connectionId) ?? null;
  }

  async delete(connectionId: string): Promise<void> {
    this.store.delete(connectionId);
  }
}
