/** Turn commands shared by authors and the lifecycle executor. */
export interface ContextTurnCapability {
  is: (playerId: number) => boolean;
  requireCurrent: (playerId: number) => void;
  number: () => number;
  direction: () => 1 | -1;
  end: () => void;
  complete: (options?: { waiting?: boolean }) => boolean;
  reverse: () => void;
  skip: (playerId?: number, count?: number) => void;
  skipCount: (playerId: number) => number;
  cancelSkip: (playerId: number, count?: number) => number;
  extra: (count?: number, playerId?: number) => void;
  extraCount: (playerId?: number) => number;
  clearExtra: (playerId?: number) => void;
  replaceUpcoming: (playerId: number, replacementId: number) => void;
  swapUpcoming: (firstPlayerId: number, secondPlayerId: number) => void;
  replacementFor: (playerId: number) => number | null;
  spend: (points?: number) => number;
  remaining: () => number | null;
  to: (
    playerId: number,
    options?: {
      announce?: boolean;
    },
  ) => void;
  waitForAll: (sessionId: string) => void;
  waitingSession: () => string | null;
  waitingPlayers: (sessionId?: string) => number[];
  completeWaiting: (sessionId?: string) => boolean;
  flags: {
    /** Persisted flags are untyped; consumers must validate before domain use. */
    get: (key: string) => unknown;
    set: (key: string, value?: unknown) => void;
    consume: (key: string) => boolean;
    clear: () => void;
  };
}
