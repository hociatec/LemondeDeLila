import type { MessageViewEvent } from './game-ws-message-system-view';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 128) : '';
}

function revealedQuizSessions(
  events: readonly MessageViewEvent[],
  viewerPlayerId: number | null,
): ReadonlySet<string> {
  const sessions = new Set<string>();
  if (viewerPlayerId == null) return sessions;
  for (const event of events) {
    if (event.type !== 'quiz.revealed') continue;
    const data = record(event.data);
    const answers = record(data.answers);
    if (typeof answers[String(viewerPlayerId)] !== 'number') continue;
    const sessionId = text(data.sessionId);
    if (sessionId) sessions.add(sessionId);
  }
  return sessions;
}

function soundSemantic(
  event: MessageViewEvent,
  viewerPlayerId: number | null,
  revealedSessions: ReadonlySet<string>,
): string {
  const data = record(event.data);
  if (event.type === 'quiz.revealed') {
    if (viewerPlayerId == null || typeof data.correctAnswerIndex !== 'number')
      return '';
    const answer = record(data.answers)[String(viewerPlayerId)];
    if (typeof answer !== 'number') return '';
    return answer === data.correctAnswerIndex ? 'quiz.correct' : 'quiz.wrong';
  }
  if (event.type !== 'game.message') return event.type;
  const key = text(data.key);
  const params = record(data.params);
  if (key === 'game.grid.wall.placed') return 'wall.placed';
  if (key === 'game.grid.pawn.moved' || key === 'game.grid.pawn.positioned')
    return 'pawn.placed';
  if (key !== 'game.quiz.answered' || typeof params.correct !== 'boolean')
    return '';
  const sessionId = text(params.sessionId);
  if (sessionId && revealedSessions.has(sessionId)) return '';
  return params.correct ? 'quiz.correct' : 'quiz.wrong';
}

export function withSoundSemantics(
  events: readonly MessageViewEvent[],
  latestByType: Readonly<Record<string, MessageViewEvent>>,
  viewerPlayerId: number | null,
): {
  recent: MessageViewEvent[];
  latestByType: Record<string, MessageViewEvent>;
} {
  const revealedSessions = revealedQuizSessions(events, viewerPlayerId);
  const present = (event: MessageViewEvent): MessageViewEvent => {
    const semantic = soundSemantic(event, viewerPlayerId, revealedSessions);
    return semantic ? { ...event, soundSemantic: semantic } : event;
  };
  return {
    recent: events.map(present),
    latestByType: Object.fromEntries(
      Object.entries(latestByType).map(([key, event]) => [key, present(event)]),
    ),
  };
}
