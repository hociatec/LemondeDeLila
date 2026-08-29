import {
  GameRuleViolationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';
import type { EventVisibility } from '../models/game-event.model';
import type { PlayerStateEntity } from '../models/game-state.model';

export type SubmissionSession = {
  id: string;
  kind: 'submission' | 'vote';
  participantPlayerIds: number[];
  valuesByPlayerId: Record<string, unknown>;
  allowedValues: readonly unknown[] | null;
  secret: boolean;
  closed: boolean;
  revealed: boolean;
};

export type SubmissionKitState = {
  sessions: Record<string, SubmissionSession>;
  judges: Record<string, { playerIds: number[]; index: number }>;
};

export type SubmissionPlayerView = {
  stage: SubmissionFlowStage;
  sessions: Record<
    string,
    {
      kind: SubmissionSession['kind'];
      participantPlayerIds: number[];
      submittedPlayerIds: number[];
      pendingPlayerIds: number[];
      valuesByPlayerId?: Record<string, unknown>;
      ownValue?: unknown;
      closed: boolean;
      revealed: boolean;
    }
  >;
  judges: Record<
    string,
    { playerId: number; playerIds: number[]; index: number }
  >;
};

export type SubmissionFlowStage =
  | 'idle'
  | 'collecting'
  | 'ready-to-reveal'
  | 'revealed'
  | 'voting'
  | 'complete';

export type SubmissionEmitter = (
  type: string,
  data: Record<string, unknown>,
  visibility?: EventVisibility,
) => void;

export function createSubmissionKitState(): SubmissionKitState {
  return { sessions: {}, judges: {} };
}

export class GameSubmissionController {
  constructor(
    protected readonly state: SubmissionKitState,
    protected readonly players: readonly PlayerStateEntity[],
    protected readonly emit: SubmissionEmitter,
  ) {}

  open(options: {
    id: string;
    players?: readonly number[];
    secret?: boolean;
  }): void {
    this.createSession('submission', options, null);
  }

  submit<TValue>(id: string, playerId: number, value: TValue): void {
    const session = this.requireOpen(id, 'submission', playerId);
    session.valuesByPlayerId[String(playerId)] = structuredClone(value);
    this.emit(
      'submission.received',
      { sessionId: id, playerId },
      session.secret
        ? {
            kind: 'split',
            privateDataByPlayer: {
              [String(playerId)]: { value: structuredClone(value) },
            },
          }
        : { kind: 'public' },
    );
    this.closeWhenComplete(session);
  }

  replace<TValue>(id: string, playerId: number, value: TValue): void {
    const session = this.require(id);
    if (
      session.kind !== 'submission' ||
      session.revealed ||
      !session.participantPlayerIds.includes(playerId)
    ) {
      throw new GameRuleViolationError('SUBMISSION_REPLACE_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    session.valuesByPlayerId[String(playerId)] = structuredClone(value);
    this.emit(
      'submission.replaced',
      { sessionId: id, playerId },
      session.secret
        ? {
            kind: 'split',
            privateDataByPlayer: {
              [String(playerId)]: { value: structuredClone(value) },
            },
          }
        : { kind: 'public' },
    );
    this.closeWhenComplete(session);
  }

  pendingPlayers(id: string): number[] {
    const session = this.require(id);
    return session.participantPlayerIds.filter(
      (playerId) => !(String(playerId) in session.valuesByPlayerId),
    );
  }

  isComplete(id: string): boolean {
    return this.pendingPlayers(id).length === 0;
  }

  has(id: string): boolean {
    return this.state.sessions[id] != null;
  }

  session(id: string): SubmissionSession | null {
    const session = this.state.sessions[id];
    return session ? structuredClone(session) : null;
  }

  reorderPending(id: string, playerIds: readonly number[]): void {
    const session = this.require(id);
    const pending = this.pendingPlayers(id);
    if (
      playerIds.length !== pending.length ||
      playerIds.some((playerId) => !pending.includes(playerId))
    ) {
      throw new GameRuleViolationError('SUBMISSION_PENDING_ORDER_INVALID', {
        id,
        playerIds,
      });
    }
    const submitted = session.participantPlayerIds.filter(
      (playerId) => !pending.includes(playerId),
    );
    session.participantPlayerIds = [...submitted, ...playerIds];
    this.emit('submission.pending.reordered', {
      sessionId: id,
      pendingPlayerIds: [...playerIds],
    });
  }

  reveal<TValue>(id: string): Record<string, TValue> {
    const session = this.require(id);
    if (!session.closed) {
      throw new GameStateViolationError('Soumissions encore ouvertes', {
        sessionId: id,
        pendingPlayerIds: this.pendingPlayers(id),
      });
    }
    session.revealed = true;
    this.emit('submissions.revealed', {
      sessionId: id,
      valuesByPlayerId: structuredClone(session.valuesByPlayerId),
    });
    return structuredClone(session.valuesByPlayerId as Record<string, TValue>);
  }

  values<TValue>(id: string): Record<string, TValue> {
    return structuredClone(
      this.require(id).valuesByPlayerId as Record<string, TValue>,
    );
  }

  clear(id: string): void {
    delete this.state.sessions[id];
  }

  protected createSession(
    kind: SubmissionSession['kind'],
    options: {
      id: string;
      players?: readonly number[];
      secret?: boolean;
    },
    allowedValues: readonly unknown[] | null,
  ): void {
    if (
      this.state.sessions[options.id] &&
      !this.state.sessions[options.id].closed
    ) {
      throw new GameStateViolationError('Session de soumission déjà ouverte', {
        sessionId: options.id,
      });
    }
    const known = new Set(this.players.map((player) => player.id));
    const participantPlayerIds = [
      ...new Set(options.players ?? this.players.map((player) => player.id)),
    ];
    if (
      participantPlayerIds.length === 0 ||
      participantPlayerIds.some((playerId) => !known.has(playerId))
    ) {
      throw new GameStateViolationError(
        'Participants de soumission invalides',
        {
          sessionId: options.id,
          participantPlayerIds,
        },
      );
    }
    this.state.sessions[options.id] = {
      id: options.id,
      kind,
      participantPlayerIds,
      valuesByPlayerId: {},
      allowedValues: allowedValues ? structuredClone(allowedValues) : null,
      secret: options.secret ?? true,
      closed: false,
      revealed: false,
    };
    this.emit(`${kind}.opened`, {
      sessionId: options.id,
      participantPlayerIds,
    });
  }

  protected require(id: string): SubmissionSession {
    const session = this.state.sessions[id];
    if (!session) {
      throw new GameStateViolationError('Session de soumission absente', {
        sessionId: id,
      });
    }
    return session;
  }

  protected requireOpen(
    id: string,
    kind: SubmissionSession['kind'],
    playerId: number,
  ): SubmissionSession {
    const session = this.require(id);
    if (session.kind !== kind || session.closed) {
      throw new GameRuleViolationError('SUBMISSION_CLOSED', { id, kind });
    }
    if (!session.participantPlayerIds.includes(playerId)) {
      throw new GameRuleViolationError('SUBMISSION_PLAYER_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    if (String(playerId) in session.valuesByPlayerId) {
      throw new GameRuleViolationError('SUBMISSION_ALREADY_RECEIVED', {
        id,
        playerId,
      });
    }
    return session;
  }

  protected closeWhenComplete(session: SubmissionSession): void {
    if (this.pendingPlayers(session.id).length > 0) return;
    session.closed = true;
    this.emit(`${session.kind}.closed`, { sessionId: session.id });
  }
}
