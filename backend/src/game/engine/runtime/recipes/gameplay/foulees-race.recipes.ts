import type { FouleesRaceProgram } from '../../contracts/foulees-race-program';
import type { GameContext } from '../../definitions/game-author-context';
import type { PawnMove } from '../../kits/pawn-kit';
import { defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { rollDice } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
type Pending = { actorId: number };

export function fouleesRaceRules(source: FouleesRaceProgram) {
  const program = structuredClone(source);
  const selection = sequentialPawnSelection<State>({
    setId: program.setId,
    choiceId: program.familyChoiceId,
    groups: program.families.map((family) => ({
      id: family.id,
      label: `${family.family} (${family.habitat})`,
      pawnIds: family.pawns.map((_pawn, index) => `${family.id}:${index}`),
    })),
    complete: ({ ctx }) => {
      ctx.phase.transitionTo('turn');
      const first = ctx.players.all()[0];
      if (first) ctx.turn.to(first.id);
    },
  });
  const finishTurn = (total: number, ctx: Context) => {
    if (total === 6) ctx.turn.extra();
    ctx.turn.complete();
  };
  const roll = rollDice<State>({
    diceId: program.diceId,
    available: ({ ctx }) => ctx.phase.current() === 'turn',
    execute: ({ playerId, total, ctx }) => {
      const moves = legalMoves(program, playerId, total, ctx);
      if (moves.length === 0) return finishTurn(total, ctx);
      if (moves.length === 1) {
        move(program, playerId, moves[0], ctx);
        return finishTurn(total, ctx);
      }
      ctx.choice.one({
        id: program.moveChoiceId,
        player: playerId,
        options: moves.map(encode),
        data: { actorId: playerId } satisfies Pending,
        label: (value) => describe(program, playerId, value, ctx),
      });
    },
    documentation:
      'Lance le dé puis déplace un animal selon les règles de course.',
  });
  return {
    roll,
    setup: selection.setup(() => ({})),
    choices: {
      [program.familyChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) =>
          selection.resolve(actor.id, value, ctx),
      }),
      [program.moveChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ value, ctx }) => {
          const pending = ctx.choice.consumeContinuation<Pending>();
          if (!pending)
            throw new GameRuleViolationError('FOULEES_MOVE_MISSING');
          const total = ctx.dice.last(program.diceId)?.total;
          if (total == null)
            throw new GameRuleViolationError('FOULEES_ROLL_MISSING');
          const selected = legalMoves(
            program,
            pending.actorId,
            total,
            ctx,
          ).find((candidate) => encode(candidate) === value);
          if (!selected)
            throw new GameRuleViolationError('FOULEES_MOVE_INVALID');
          move(program, pending.actorId, selected, ctx);
          finishTurn(total, ctx);
        },
      }),
    },
  };
}

function legalMoves(
  program: FouleesRaceProgram,
  playerId: number,
  total: number,
  ctx: Context,
): PawnMove[] {
  const offset = playerOffset(program, playerId, ctx);
  const arrival = program.trackLength + program.homeLength - 1;
  const opponents = opponentPositions(program, playerId, ctx);
  const own = pawns(program, playerId, ctx);
  const occupied = new Set(
    own
      .filter(
        (pawn) => pawn.progress >= 0 && pawn.progress < program.trackLength,
      )
      .map((pawn) => (offset + pawn.progress) % program.trackLength),
  );
  return ctx.pawns.legalMoves(program.setId, playerId, total, {
    target: ({ from }) => target(program, from, total, arrival),
    canLand: ({ from, to }) => {
      if (from >= 0 && blocked(program, offset, from, to, total, opponents))
        return false;
      if (to < 0 || to >= program.trackLength) return true;
      const destination = (offset + to) % program.trackLength;
      return (
        !occupied.has(destination) &&
        !(
          opponents.has(destination) && safeTiles(program, ctx).has(destination)
        )
      );
    },
  });
}

function target(
  program: FouleesRaceProgram,
  from: number,
  roll: number,
  arrival: number,
) {
  if (from >= arrival) return null;
  if (from < 0) return roll === 6 ? 0 : null;
  if (from >= program.trackLength) {
    const homeIndex = from - program.trackLength + 1;
    return homeIndex < program.homeLength && roll === homeIndex + 1
      ? from + 1
      : null;
  }
  const next = from + roll;
  return next > arrival || next > program.trackLength ? null : next;
}

function blocked(
  program: FouleesRaceProgram,
  offset: number,
  from: number,
  destination: number,
  roll: number,
  opponents: ReadonlySet<number>,
) {
  for (let step = 1; step <= roll; step += 1) {
    const progress = from + step;
    if (progress >= program.trackLength) break;
    const position = (offset + progress) % program.trackLength;
    if (opponents.has(position) && progress !== destination) return true;
  }
  return false;
}

function move(
  program: FouleesRaceProgram,
  playerId: number,
  selected: PawnMove,
  ctx: Context,
) {
  const arrival = program.trackLength + program.homeLength - 1;
  ctx.pawns.applyRaceMove(program.setId, playerId, selected, {
    finishAt: arrival,
    afterMove: () => capture(program, playerId, selected.to, ctx),
    onFinish: () =>
      ctx.match.finish({ winners: [playerId], reason: program.finishReason }),
  });
}

function capture(
  program: FouleesRaceProgram,
  playerId: number,
  progress: number,
  ctx: Context,
) {
  if (progress < 0 || progress >= program.trackLength) return;
  const destination =
    (playerOffset(program, playerId, ctx) + progress) % program.trackLength;
  if (safeTiles(program, ctx).has(destination)) return;
  for (const player of ctx.players.others(playerId)) {
    const offset = playerOffset(program, player.id, ctx);
    for (const pawn of pawns(program, player.id, ctx))
      if (
        pawn.progress >= 0 &&
        pawn.progress < program.trackLength &&
        (offset + pawn.progress) % program.trackLength === destination
      )
        ctx.pawns.moveTo(program.setId, pawn.pawnId, -1);
  }
}

function opponentPositions(
  program: FouleesRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const result = new Set<number>();
  for (const player of ctx.players.others(playerId))
    for (const pawn of pawns(program, player.id, ctx))
      if (pawn.progress >= 0 && pawn.progress < program.trackLength)
        result.add(
          (playerOffset(program, player.id, ctx) + pawn.progress) %
            program.trackLength,
        );
  return result;
}

function safeTiles(program: FouleesRaceProgram, ctx: Context) {
  return new Set([
    ...program.safeTiles,
    ...ctx.players.all().map((player) => playerOffset(program, player.id, ctx)),
  ]);
}

function pawns(program: FouleesRaceProgram, playerId: number, ctx: Context) {
  return ctx.pawns.assigned(program.setId, playerId).map((pawnId) => ({
    pawnId,
    progress: ctx.pawns.position(program.setId, pawnId),
  }));
}

function playerOffset(
  program: FouleesRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const index = Math.max(
    0,
    ctx.players.all().findIndex((player) => player.id === playerId),
  );
  return [
    0,
    Math.floor(program.trackLength / 2),
    Math.floor(program.trackLength / 4),
    Math.floor((program.trackLength * 3) / 4),
  ][index];
}

function encode(move: PawnMove) {
  return `${move.pawnId}:${move.to}`;
}

function describe(
  program: FouleesRaceProgram,
  playerId: number,
  value: string,
  ctx: Context,
) {
  const parts = value.split(':');
  const pawnIndex = Number(parts.at(-2));
  const progress = Number(parts.at(-1));
  const familyId = ctx.pawns
    .assigned(program.setId, playerId)[0]
    ?.split(':')[0];
  const family = program.families.find((item) => item.id === familyId);
  return `${family?.pawns[pawnIndex] ?? `Animal ${pawnIndex + 1}`} vers ${progress}`;
}
