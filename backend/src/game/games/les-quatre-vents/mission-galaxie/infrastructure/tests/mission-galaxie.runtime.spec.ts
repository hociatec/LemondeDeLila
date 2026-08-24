import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { createMissionGalaxieRuntime } from '../../mission-galaxie.runtime';

describe('MissionGalaxie runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createMissionGalaxieRuntime({
      contentLoader: {
        validators: {
          version: () => () => undefined,
          arrayField: () => () => undefined,
        },
        loadContent: ({ filename }: { filename: string }) => {
          if (filename === 'board.json') {
            return { version: 1, tiles: [{ id: 'start', title: 'Départ' }] };
          }
          if (filename === 'questions.json') {
            return { version: 1, questions: [{ id: 'q1', question: 'Q?' }] };
          }
          if (filename === 'challenges.json') {
            return { version: 1, challenges: [{ id: 'c1', title: 'Défi' }] };
          }
          if (filename === 'events.json') {
            return { version: 1, events: [{ id: 'e1', title: 'Event' }] };
          }
          throw new Error(`Unexpected file ${filename}`);
        },
      },
      random: {
        shuffle: (meta: any, values: any[]) => ({ meta, values }),
      } as any,
      core: { appendLog: (state: any) => state } as any,
      turns: {} as any,
    });

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [{ id: 1, username: 'Alice' } as any],
      metadata: {},
    };

    const state = service.hydrateInitialState(base);

    expect(state.phase).toBe('playing');
    expect((state.metadata as any).positions?.[1]).toBe(0);
    expect(Array.isArray((state.metadata as any).tiles)).toBe(true);
  });
});

