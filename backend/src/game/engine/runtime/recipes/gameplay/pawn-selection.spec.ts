import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { sequentialPawnSelection } from './pawn-selection.recipes';

it('uses the same shuffled order for round initialization and pawn selection', () => {
  const { recipe, ctx } = fixture();
  const round = { start: jest.fn() };
  const random = { shuffle: jest.fn(() => [3, 1, -2]) };
  const settings = { order: 'shuffled' as const, startRound: true };
  const setup = recipe.setup(() => ({}), settings);
  settings.startRound = false;
  setup({
    players: ctx.players
      .all()
      .map((player) => ({ ...player, username: String(player.id) })),
    ctx: { ...ctx, round, random } as never,
  });
  expect(round.start).toHaveBeenCalledWith(3, [3, 1, -2]);
  expect(ctx.choice.pawn).toHaveBeenCalledWith(
    expect.objectContaining({ data: { pawnSelectionPlayerIds: [3, 1, -2] } }),
  );
});

function fixture() {
  const complete = jest.fn();
  const recipe = sequentialPawnSelection({
    setId: 'pawns',
    choiceId: 'choose-pawn',
    complete,
  });
  const ctx = {
    players: { all: () => [{ id: 1 }, { id: -2, isBot: true }, { id: 3 }] },
    turn: { to: jest.fn() },
    pawns: { available: () => [{ id: 'blue', label: 'Blue' }] },
    events: { message: jest.fn() },
    choice: { pawn: jest.fn() },
  };
  return { recipe, ctx, complete };
}

it.each([0, 99, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid participants before any turn, message or choice mutation: %s',
  (id) => {
    const { recipe, ctx, complete } = fixture();
    expect(() => recipe.requestAll([1, id], ctx as never)).toThrow(
      GameRuleViolationError,
    );
    expect(() => recipe.request(id, ctx as never)).toThrow(
      GameRuleViolationError,
    );
    expect(ctx.turn.to).not.toHaveBeenCalled();
    expect(ctx.events.message).not.toHaveBeenCalled();
    expect(ctx.choice.pawn).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  },
);

it('preserves declared human order, deduplicates participants and queues bots afterward', () => {
  const { recipe, ctx } = fixture();
  recipe.requestAll([-2, 3, 1, 3], ctx as never);
  expect(ctx.turn.to).toHaveBeenCalledWith(3, { announce: false });
  expect(ctx.choice.pawn).toHaveBeenCalledWith(
    expect.objectContaining({
      player: 3,
      options: ['blue'],
      data: { pawnSelectionPlayerIds: [3, 1, -2] },
    }),
  );
});

it('initializes pawn selection in declared order with a fresh game state each time', () => {
  const { recipe, ctx } = fixture();
  const setup = recipe.setup(() => ({ awaitingCardDraw: false }));
  const input = {
    ctx: ctx as never,
    players: [
      { id: 3, username: 'Three' },
      { id: 1, username: 'One' },
    ],
  };
  const first = setup(input);
  const second = setup(input);
  expect(first).toEqual({ awaitingCardDraw: false });
  expect(first).not.toBe(second);
  expect(ctx.choice.pawn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      player: 3,
      data: { pawnSelectionPlayerIds: [3, 1] },
    }),
  );
});

it('completes a generic selection by entering its phase and restoring the round starter', () => {
  const recipe = sequentialPawnSelection({
    setId: 'pawns',
    choiceId: 'choose-pawn',
    completePhase: 'playing',
  });
  const ctx = {
    players: { all: () => [] },
    turn: { to: jest.fn() },
    phase: { transitionTo: jest.fn() },
    round: { starter: () => 7 },
  };

  recipe.requestAll([], ctx as never);

  expect(ctx.phase.transitionTo).toHaveBeenCalledWith('playing');
  expect(ctx.turn.to).toHaveBeenCalledWith(7);
});
