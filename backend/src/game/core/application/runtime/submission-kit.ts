import {
  GameRuleViolationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';
import type { EventVisibility } from '../models/game-event.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import { sameSerializableValue } from './serializable-value';

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

type SubmissionEmitter = (
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

export class GameVotingController extends GameSubmissionController {
  open(options: {
    id: string;
    players?: readonly number[];
    choices?: readonly unknown[];
    secret?: boolean;
  }): void {
    if (!options.choices || options.choices.length === 0) {
      throw new GameStateViolationError('Un vote requiert des choix', {
        sessionId: options.id,
      });
    }
    this.createSession('vote', options, options.choices);
  }

  vote<TValue>(id: string, playerId: number, value: TValue): void {
    const session = this.requireOpen(id, 'vote', playerId);
    if (
      !session.allowedValues?.some((candidate) =>
        sameSerializableValue(candidate, value),
      )
    ) {
      throw new GameRuleViolationError('VOTE_VALUE_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    session.valuesByPlayerId[String(playerId)] = structuredClone(value);
    this.emit(
      'vote.received',
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

  tally(id: string): Array<{ value: unknown; votes: number }> {
    const session = this.require(id);
    if (session.kind !== 'vote' || !session.closed) {
      throw new GameStateViolationError('Vote encore ouvert', {
        sessionId: id,
      });
    }
    const results: Array<{ value: unknown; votes: number }> = [];
    for (const value of Object.values(session.valuesByPlayerId)) {
      const existing = results.find((candidate) =>
        sameSerializableValue(candidate.value, value),
      );
      if (existing) existing.votes += 1;
      else results.push({ value: structuredClone(value), votes: 1 });
    }
    return results.sort((left, right) => right.votes - left.votes);
  }
}

export class GameJudgeController {
  constructor(
    private readonly state: SubmissionKitState,
    private readonly players: readonly PlayerStateEntity[],
    private readonly emit: SubmissionEmitter,
  ) {}

  has(id: string): boolean {
    return this.state.judges[id] != null;
  }

  start(
    id: string,
    options: { players?: readonly number[]; starterPlayerId?: number } = {},
  ): number {
    const known = new Set(this.players.map((player) => player.id));
    const playerIds = [
      ...new Set(options.players ?? this.players.map((player) => player.id)),
    ];
    if (
      playerIds.length === 0 ||
      playerIds.some((playerId) => !known.has(playerId))
    ) {
      throw new GameStateViolationError('Rotation de juge invalide', {
        id,
        playerIds,
      });
    }
    const starterIndex =
      options.starterPlayerId == null
        ? 0
        : playerIds.indexOf(options.starterPlayerId);
    this.state.judges[id] = {
      playerIds,
      index: Math.max(0, starterIndex),
    };
    const playerId = this.current(id);
    this.emit('judge.started', { id, playerId, playerIds: [...playerIds] });
    return playerId;
  }

  current(id: string): number {
    const rotation = this.require(id);
    const playerId =
      rotation.playerIds[rotation.index % rotation.playerIds.length];
    if (playerId == null) {
      throw new GameStateViolationError('Rotation de juge vide', { id });
    }
    return playerId;
  }

  next(id: string): number {
    const rotation = this.require(id);
    rotation.index = (rotation.index + 1) % rotation.playerIds.length;
    const playerId = this.current(id);
    this.emit('judge.changed', { id, playerId, index: rotation.index });
    return playerId;
  }

  setCurrent(id: string, playerId: number): number {
    const rotation = this.require(id);
    const index = rotation.playerIds.indexOf(playerId);
    if (index < 0) {
      throw new GameRuleViolationError('JUDGE_PLAYER_NOT_ALLOWED', {
        id,
        playerId,
      });
    }
    rotation.index = index;
    this.emit('judge.changed', { id, playerId, index });
    return playerId;
  }

  index(id: string): number {
    return this.require(id).index;
  }

  private require(id: string): { playerIds: number[]; index: number } {
    const rotation = this.state.judges[id];
    if (!rotation) {
      throw new GameStateViolationError('Rotation de juge absente', { id });
    }
    return rotation;
  }
}

/**
 * Pipeline commun collecte → reveal → vote/jury. Il compose les trois
 * contrôleurs spécialisés et porte la synchronisation des tours simultanés,
 * sans introduire de champs `roundStage` ou `pending*` dans l'état du jeu.
 */
export class GameSubmissionFlowController {
  constructor(
    private readonly submissions: GameSubmissionController,
    private readonly voting: GameVotingController,
    private readonly judge: GameJudgeController,
    private readonly simultaneous: {
      waitForAll(sessionId: string): void;
      completeWaiting(sessionId: string): boolean;
    },
  ) {}

  open(options: {
    id: string;
    players?: readonly number[];
    secret?: boolean;
    waitForAll?: boolean;
    replace?: boolean;
  }): void {
    if (options.replace !== false && this.submissions.has(options.id)) {
      this.submissions.clear(options.id);
    }
    this.submissions.open(options);
    if (options.waitForAll) this.simultaneous.waitForAll(options.id);
  }

  openForJudge(options: {
    submissionId: string;
    judgeId: string;
    players: readonly number[];
    secret?: boolean;
    rotateJudge?: boolean;
    waitForAll?: boolean;
  }): { judgePlayerId: number; participantPlayerIds: number[] } {
    const judgePlayerId = options.rotateJudge
      ? this.judge.next(options.judgeId)
      : this.judge.current(options.judgeId);
    const participantPlayerIds = options.players.filter(
      (playerId) => playerId !== judgePlayerId,
    );
    this.open({
      id: options.submissionId,
      players: participantPlayerIds,
      secret: options.secret,
      waitForAll: options.waitForAll,
    });
    return { judgePlayerId, participantPlayerIds };
  }

  submit<TValue>(id: string, playerId: number, value: TValue): boolean {
    this.submissions.submit(id, playerId, value);
    return this.submissions.isComplete(id);
  }

  vote<TValue>(id: string, playerId: number, value: TValue): boolean {
    this.voting.vote(id, playerId, value);
    return this.voting.isComplete(id);
  }

  completeWaiting(id: string): boolean {
    return this.simultaneous.completeWaiting(id);
  }

  reveal<TValue>(id: string): Record<string, TValue> {
    return this.submissions.reveal<TValue>(id);
  }

  revealAndOpenVote<TValue>(options: {
    submissionId: string;
    voteId: string;
    choices?: readonly unknown[];
    voters?: readonly number[];
    secret?: boolean;
    waitForAll?: boolean;
  }): Record<string, TValue> {
    const submissions = this.reveal<TValue>(options.submissionId);
    if (this.voting.has(options.voteId)) this.voting.clear(options.voteId);
    this.voting.open({
      id: options.voteId,
      players: options.voters,
      choices:
        options.choices ??
        Object.keys(submissions).map((playerId) => +playerId),
      secret: options.secret,
    });
    if (options.waitForAll) this.simultaneous.waitForAll(options.voteId);
    return submissions;
  }

  startJudge(
    id: string,
    options: { players?: readonly number[]; starterPlayerId?: number } = {},
  ): number {
    return this.judge.has(id)
      ? this.judge.current(id)
      : this.judge.start(id, options);
  }

  nextJudge(id: string): number {
    return this.judge.next(id);
  }

  stage(submissionId: string, voteId?: string): SubmissionFlowStage {
    const vote = voteId ? this.voting.session(voteId) : null;
    if (vote) return vote.closed ? 'complete' : 'voting';
    const submission = this.submissions.session(submissionId);
    if (!submission) return 'idle';
    if (!submission.closed) return 'collecting';
    return submission.revealed ? 'revealed' : 'ready-to-reveal';
  }

  reset(...sessionIds: readonly string[]): void {
    for (const sessionId of sessionIds) {
      if (this.submissions.has(sessionId)) this.submissions.clear(sessionId);
    }
  }
}

export function projectSubmissions(
  state: SubmissionKitState,
  viewerPlayerId: number | null,
): SubmissionPlayerView {
  return {
    stage: projectSubmissionStage(state),
    sessions: Object.fromEntries(
      Object.entries(state.sessions).map(([id, session]) => {
        const submittedPlayerIds = Object.keys(session.valuesByPlayerId).map(
          Number,
        );
        const pendingPlayerIds = session.participantPlayerIds.filter(
          (playerId) => !submittedPlayerIds.includes(playerId),
        );
        const maySeeAll = session.revealed || !session.secret;
        const ownValue =
          viewerPlayerId == null
            ? undefined
            : session.valuesByPlayerId[String(viewerPlayerId)];
        return [
          id,
          {
            kind: session.kind,
            participantPlayerIds: [...session.participantPlayerIds],
            submittedPlayerIds,
            pendingPlayerIds,
            closed: session.closed,
            revealed: session.revealed,
            ...(maySeeAll
              ? {
                  valuesByPlayerId: structuredClone(session.valuesByPlayerId),
                }
              : ownValue === undefined
                ? {}
                : { ownValue: structuredClone(ownValue) }),
          },
        ];
      }),
    ),
    judges: Object.fromEntries(
      Object.entries(state.judges).map(([id, rotation]) => [
        id,
        {
          playerId:
            rotation.playerIds[rotation.index % rotation.playerIds.length],
          playerIds: [...rotation.playerIds],
          index: rotation.index,
        },
      ]),
    ),
  };
}

function projectSubmissionStage(
  state: SubmissionKitState,
): SubmissionFlowStage {
  const sessions = Object.values(state.sessions);
  const vote = sessions.find((session) => session.kind === 'vote');
  if (vote) return vote.closed ? 'complete' : 'voting';
  const submission = sessions.find((session) => session.kind === 'submission');
  if (!submission) return 'idle';
  if (!submission.closed) return 'collecting';
  return submission.revealed ? 'revealed' : 'ready-to-reveal';
}
