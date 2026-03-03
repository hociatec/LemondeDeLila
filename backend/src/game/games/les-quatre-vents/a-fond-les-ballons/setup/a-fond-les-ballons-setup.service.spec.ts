import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { AFondLesBallonsSetupService } from './a-fond-les-ballons-setup.service';

function makeBase(players = 3) {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: Array.from({ length: players }, (_, i) => ({
      id: i + 1,
      username: `P${i + 1}`,
    })),
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {},
    pending: null,
    botThinking: false,
  } as any;
}

function makeService() {
  const random = new RandomService();
  jest
    .spyOn(random, 'shuffle')
    .mockImplementation((meta: any, values: any[]) => ({
      values: [...values],
      meta,
    }));
  return new AFondLesBallonsSetupService(
    new GameCoreService(),
    random,
    new GameContentLoaderService(),
    new SetupFlowService(),
  );
}

describe('AFondLesBallonsSetupService', () => {
  it('hydrates state with deck, board and sequential pawn pending', () => {
    const service = makeService();
    const state = service.hydrateInitialState(makeBase());

    const meta = state.metadata as any;
    expect(meta.tiles).toHaveLength(40);
    expect(Array.isArray(meta.decks?.loufoque)).toBe(true);
    expect(meta.positions[1]).toBe(0);
    expect(state.pending?.type).toBe('choose_pawn');
    expect(state.turn?.currentPlayerId).toBeDefined();
  });

  it('accepts pre-assigned unique pawns and skips pending when all assigned', () => {
    const service = makeService();
    const state = service.hydrateInitialState({
      ...makeBase(),
      metadata: {
        setupStarterId: 2,
        pawnByPlayerId: {
          1: 'capitaine-cacahuete',
          2: 'professeur-gribouille',
          3: 'miss-froufrou',
        },
      },
    });

    const meta = state.metadata as any;
    expect(meta.pawnByPlayerId[1]).toBe('capitaine-cacahuete');
    expect(meta.charactersByPlayerId[2]?.name).toBeTruthy();
    expect(state.pending).toBeNull();
    expect(state.turn?.currentPlayerId).toBe(2);
  });

  it('normalizes pawn input by label and ignores duplicate assignment', () => {
    const service = makeService();
    const state = service.hydrateInitialState({
      ...makeBase(),
      metadata: {
        pawnByPlayerId: {
          1: { value: 'Capitaine Cacahuète' },
          2: { pawnId: 'Capitaine Cacahuète' },
          3: { id: 'Miss Froufrou' },
        },
      },
    });

    const meta = state.metadata as any;
    expect(meta.pawnByPlayerId[1]).toBe('capitaine-cacahuete');
    expect(meta.pawnByPlayerId[2]).toBeUndefined();
    expect(meta.pawnByPlayerId[3]).toBe('miss-froufrou');
  });
});
