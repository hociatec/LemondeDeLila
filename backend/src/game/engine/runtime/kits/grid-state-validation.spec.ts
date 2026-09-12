import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import { createGridKitState, GameGridController, grid } from './grid-kit';

function fixture() {
  const state = createGridKitState<string>();
  const controller = new GameGridController(state);
  controller.create(grid.board({ id: 'board', width: 3, height: 3 }));
  return { state, controller };
}

it.each(['0,0,1', '00,0', '0, 0', '0,', ',0', '-0,0', '1e0,0'])(
  'rejects noncanonical restored coordinate %s',
  (key) => {
    const { state, controller } = fixture();
    state.cells.board[key] = 'player';
    expect(() => controller.assertValid()).toThrow(GameStateViolationError);
  },
);

it.each([null, [], 'invalid', 1])(
  'rejects malformed restored grid map %j',
  (value) => {
    const { state, controller } = fixture();
    Object.assign(state.cells, { board: value });
    expect(() => controller.assertValid()).toThrow(GameStateViolationError);
  },
);

it.each([null, [], 'invalid', 1])(
  'rejects malformed restored overlay map %j',
  (value) => {
    const { state, controller } = fixture();
    Object.assign(state.overlays, { board: value });
    expect(() => controller.assertValid()).toThrow(GameStateViolationError);
  },
);

it('rejects overlays of an unknown board and malformed layers', () => {
  const { state, controller } = fixture();
  state.overlays.unknown = { walls: [] };
  expect(() => controller.assertValid()).toThrow(GameStateViolationError);
  delete state.overlays.unknown;
  Object.assign(state.overlays, { board: { walls: {} } });
  expect(() => controller.assertValid()).toThrow(GameStateViolationError);
});

it('restores valid coordinates and overlays without changing their values', () => {
  const { state, controller } = fixture();
  controller.set('board', { x: 2, y: 1 }, 'player');
  controller.setOverlays('board', 'walls', [{ x: 0, y: 1 }]);
  const restored = new GameGridController(structuredClone(state), [
    grid.board({ id: 'board', width: 3, height: 3 }),
  ]);
  expect(() => restored.assertValid()).not.toThrow();
  expect(restored.get('board', { x: 2, y: 1 })).toBe('player');
  expect(restored.overlays('board', 'walls')).toEqual([{ x: 0, y: 1 }]);
});

it('enumerates restored cells in canonical row-major order', () => {
  const { state, controller } = fixture();
  state.cells.board = {
    '2,2': 'last',
    '1,0': 'second',
    '0,1': 'third',
    '0,0': 'first',
  };
  expect(controller.entries('board')).toEqual([
    { position: { x: 0, y: 0 }, value: 'first' },
    { position: { x: 1, y: 0 }, value: 'second' },
    { position: { x: 0, y: 1 }, value: 'third' },
    { position: { x: 2, y: 2 }, value: 'last' },
  ]);
});
