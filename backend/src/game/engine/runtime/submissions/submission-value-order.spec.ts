import {
  createSubmissionKitState,
  GameSubmissionController,
} from './submission-controller';

const players = [
  { id: -1, username: 'one' },
  { id: -2, username: 'two' },
  { id: 3, username: 'three' },
];

it('preserves submission order across reordered storage and replacement', () => {
  const state = createSubmissionKitState<string>();
  const controller = new GameSubmissionController(state, players, jest.fn());
  controller.open({ id: 'answers' });
  controller.submit('answers', -1, 'first');
  controller.submit('answers', -2, 'second');
  const session = state.sessions.answers;
  session.valuesByPlayerId = Object.fromEntries(
    Object.entries(session.valuesByPlayerId).reverse(),
  );
  const restored = new GameSubmissionController(state, players, jest.fn());
  restored.replace('answers', -1, 'replaced');
  restored.submit('answers', 3, 'third');
  // Numeric object keys retain their standard ordering; negative IDs retain insertion ordering.
  expect(Object.keys(restored.reveal('answers'))).toEqual(['3', '-1', '-2']);
  expect(session.valueOrder).toEqual([-1, -2, 3]);
});

it('retains the observable order of legacy snapshots and persists it on the next write', () => {
  const state = createSubmissionKitState<string>();
  const controller = new GameSubmissionController(state, players, jest.fn());
  controller.open({ id: 'answers' });
  controller.submit('answers', -2, 'first');
  delete state.sessions.answers.valueOrder;
  controller.submit('answers', -1, 'second');
  expect(state.sessions.answers.valueOrder).toEqual([-2, -1]);
});

it.each([[-1, -1], [], [99]])(
  'rejects an inconsistent stored order %j',
  (...order) => {
    const state = createSubmissionKitState<string>();
    const controller = new GameSubmissionController(state, players, jest.fn());
    controller.open({ id: 'answers' });
    controller.submit('answers', -1, 'first');
    state.sessions.answers.valueOrder = order;
    expect(
      () => new GameSubmissionController(state, players, jest.fn()),
    ).toThrow();
  },
);
