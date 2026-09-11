import { createSubmissionKitState } from './submission-controller';
import { GameVotingController } from './submission-voting-controller';

it('uses declared choice order as the deterministic tie-break for a tally', () => {
  const controller = new GameVotingController(
    createSubmissionKitState<string>(),
    [
      { id: 1, username: 'one' },
      { id: 2, username: 'two' },
      { id: 3, username: 'three' },
    ],
    jest.fn(),
  );
  controller.open({ id: 'vote', players: [1, 2, 3], choices: ['blue', 'red'] });
  controller.vote('vote', 1, 'red');
  controller.vote('vote', 2, 'blue');
  controller.vote('vote', 3, 'red');
  expect(controller.tally('vote')).toEqual([
    { value: 'red', votes: 2 },
    { value: 'blue', votes: 1 },
  ]);

  const tied = new GameVotingController(
    createSubmissionKitState<string>(),
    [
      { id: 1, username: 'one' },
      { id: 2, username: 'two' },
    ],
    jest.fn(),
  );
  tied.open({ id: 'tie', players: [1, 2], choices: ['blue', 'red'] });
  tied.vote('tie', 1, 'red');
  tied.vote('tie', 2, 'blue');
  expect(tied.tally('tie').map((entry) => entry.value)).toEqual([
    'blue',
    'red',
  ]);
});
