import { projectSubmissions } from './submission-view';
import {
  createSubmissionKitState,
  GameSubmissionController,
} from '../submissions/submission-controller';

it('keeps bot participants in pending and submitted lists without revealing secret values', () => {
  const state = createSubmissionKitState<{ card: string }>();
  const controller = new GameSubmissionController(
    state,
    [
      { id: 1, username: 'Player' },
      { id: -2, username: 'Bot', isBot: true },
    ],
    jest.fn(),
  );
  controller.open({ id: 'round', secret: true });
  controller.submit('round', 1, { card: 'human-card' });
  expect(projectSubmissions(state, 1).sessions.round).toMatchObject({
    participantPlayerIds: [1, -2],
    submittedPlayerIds: [1],
    pendingPlayerIds: [-2],
    ownValue: { card: 'human-card' },
  });
  controller.submit('round', -2, { card: 'bot-card' });
  const spectator = projectSubmissions(state, null).sessions.round;
  expect(spectator.submittedPlayerIds).toEqual(expect.arrayContaining([1, -2]));
  expect(spectator.pendingPlayerIds).toEqual([]);
  expect(spectator).not.toHaveProperty('valuesByPlayerId');
  expect(spectator).not.toHaveProperty('ownValue');
  const bot = projectSubmissions(state, -2).sessions.round;
  expect(bot.ownValue).toEqual({ card: 'bot-card' });
  if (bot.ownValue) bot.ownValue.card = 'changed';
  expect(state.sessions.round.valuesByPlayerId['-2']).toEqual({
    card: 'bot-card',
  });
  state.sessions.round.revealed = true;
  expect(
    projectSubmissions(state, null).sessions.round.valuesByPlayerId,
  ).toEqual({
    '1': { card: 'human-card' },
    '-2': { card: 'bot-card' },
  });
});

it('derives the global stage independently of persisted session key order', () => {
  const closedVote = {
    id: 'closed-vote',
    kind: 'vote' as const,
    participantPlayerIds: [1],
    valuesByPlayerId: { '1': 'yes' },
    allowedValues: ['yes'],
    secret: false,
    closed: true,
    revealed: false,
  };
  const openVote = {
    ...closedVote,
    id: 'open-vote',
    valuesByPlayerId: {},
    closed: false,
  };
  const state = {
    sessions: { closed: closedVote, open: openVote },
    judges: {},
  };
  const reordered = {
    ...state,
    sessions: { open: openVote, closed: closedVote },
  };

  expect(projectSubmissions(state, 1).stage).toBe('voting');
  expect(projectSubmissions(reordered, 1).stage).toBe('voting');
});
