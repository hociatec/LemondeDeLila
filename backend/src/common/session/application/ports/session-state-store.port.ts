export const SESSION_STORE = Symbol('SESSION_STORE');

export type SessionState = {
  userId: number | null;
  username?: string | null;
  roles?: string[] | null;
};

export interface SessionStateStore {
  save(connectionId: string, state: SessionState): Promise<void>;
  get(connectionId: string): Promise<SessionState | null>;
  delete(connectionId: string): Promise<void>;
}
