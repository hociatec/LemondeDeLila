import type { GameState } from '../models/game-state.model';
import { GameVisibilityService } from './game-visibility.service';

describe('GameVisibilityService', () => {
  it('removes engine metadata and another player pending details', () => {
    const internal = {
      status: 'started',
      phase: 'turn',
      log: [],
      players: [
        { id: 1, username: 'Alice' },
        { id: 2, username: 'Bob' },
      ],
      metadata: { rng: { seed: 12, counter: 3 } },
      pending: {
        type: 'choose',
        label: 'Choisir',
        playerId: 2,
        question: 'question privée',
        choices: ['x'],
        data: { answer: 1 },
      },
      engine: { secret: true },
    } as GameState & { engine: { secret: boolean } };

    const exposed = {
      ...internal,
      viewVersion: 1,
      system: {},
      kits: {},
      effect: {},
      game: {},
      serverSecret: 'hidden',
    };
    const view = new GameVisibilityService().project(internal, exposed, 1);

    expect(view).not.toHaveProperty('engine');
    expect(view).not.toHaveProperty('metadata');
    expect(view).not.toHaveProperty('serverSecret');
    expect(view.pending).toEqual({
      type: 'choose',
      label: 'Choisir',
      playerId: 2,
    });
    expect(internal.metadata?.rng).toEqual({ seed: 12, counter: 3 });
  });
});

it('constructs the public envelope and pending fields from an explicit whitelist', () => {
  const internal: GameState = { status: 'started', phase: 'turn', log: [] };
  const pending = {
    type: 'choose',
    playerId: 2,
    question: 'private',
    choices: ['A'],
    data: { options: ['A'] },
    queue: [{ question: 'next private' }],
    futureInternalField: 'secret',
  };
  const exposed = {
    viewVersion: 1,
    system: {},
    kits: {},
    effect: {},
    game: { publicValue: 1 },
    pending,
    serverSecret: () => 'must not even be cloned',
    gameContract: {
      stateVersion: 1,
      rulesVersion: '1',
      contentVersion: '1',
      futureSecret: 'hidden',
    },
  };
  const service = new GameVisibilityService();
  for (const viewer of [null, 1, 0, NaN, 2]) {
    const view = service.project(internal, exposed, viewer);
    expect(view).not.toHaveProperty('serverSecret');
    expect(view.gameContract).not.toHaveProperty('futureSecret');
    expect(view.pending).not.toHaveProperty('futureInternalField');
    expect(view.pending).not.toHaveProperty('queue');
    if (viewer === 2) expect(view.pending?.choices).toEqual(['A']);
    else expect(view.pending).not.toHaveProperty('choices');
  }
  const owner = service.project(internal, exposed, 2);
  owner.pending?.choices?.push('changed');
  expect(pending.choices).toEqual(['A']);
  expect(pending.queue).toHaveLength(1);
});

it.each([{ playerId: 2 }, { playerIds: [1, 2] }])(
  'hides completed choice details with either target representation: %j',
  (target) => {
    const internal: GameState = { status: 'started', phase: 'turn', log: [] };
    const exposed = {
      viewVersion: 1,
      system: {},
      kits: {},
      effect: {},
      game: {},
      pending: {
        ...target,
        resolvedPlayerIds: [2],
        question: 'private',
        choices: ['A'],
        data: { answer: 'A' },
      },
    };
    const view = new GameVisibilityService().project(internal, exposed, 2);
    expect(view.pending).not.toHaveProperty('question');
    expect(view.pending).not.toHaveProperty('choices');
    expect(view.pending).not.toHaveProperty('data');
    expect(exposed.pending.data.answer).toBe('A');
  },
);
