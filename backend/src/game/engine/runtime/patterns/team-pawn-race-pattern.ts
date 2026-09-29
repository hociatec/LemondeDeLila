import { defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import {
  rollDice,
  sequentialPawnSelection,
  type PawnMove,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type TeamPawnFamily = {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
};
export type TeamPawnRaceOptions = {
  rollRecipe: string;
  setId: string;
  diceId: string;
  familyChoiceId: string;
  moveChoiceId: string;
  families: readonly TeamPawnFamily[];
  trackLength: number;
  homeLength: number;
  safeTiles: readonly number[];
  finishReason: string;
  entryRolls: readonly number[];
  extraTurnRolls: readonly number[];
  startPositions: readonly number[];
  homeRolls: readonly number[];
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Pending = { actorId: number };

export function teamPawnRace(source: TeamPawnRaceOptions) {
  const program = structuredClone(source);
  const selection = sequentialPawnSelection<State>({
    setId: program.setId,
    choiceId: program.familyChoiceId,
    automaticBots: true,
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
    assigned: ({ playerId, pawnId, ctx }) => {
      const family = program.families.find(
        (candidate) => candidate.id === pawnId,
      );
      if (family)
        ctx.events.message(
          'game.team-pawn.family-selected',
          {
            playerId,
            habitat: family.habitat,
          },
          {
            default: `${playerName(ctx, playerId)} a choisi ${withDefiniteArticle(family.habitat)}.`,
            byPlayerId: {
              [playerId]: `Vous avez choisi ${withDefiniteArticle(family.habitat)}.`,
            },
            supersedes: ['pawn.assigned'],
          },
        );
    },
  });
  const finishTurn = (total: number, ctx: Context) => {
    if (program.extraTurnRolls.includes(total)) ctx.turn.extra();
    ctx.turn.complete();
  };
  const roll = rollDice<State>({
    diceId: program.diceId,
    available: ({ ctx }) => ctx.phase.current() === 'turn',
    message: ({ playerId, total }) => ({
      key: 'game.dice.rolled',
      params: { playerId, total },
    }),
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
      'Lance le dé puis déplace un pion selon les règles de course.',
  });
  return definePattern({
    id: `team-pawn-race:${program.setId}`,
    mechanics: ['race', 'pawns', 'capture'],
    actions: { [program.rollRecipe]: roll },
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
            throw new GameRuleViolationError('TEAM_PAWN_MOVE_MISSING');
          const total = ctx.dice.last(program.diceId)?.total;
          if (total == null)
            throw new GameRuleViolationError('TEAM_PAWN_ROLL_MISSING');
          const selected = legalMoves(
            program,
            pending.actorId,
            total,
            ctx,
          ).find((candidate) => encode(candidate) === value);
          if (!selected)
            throw new GameRuleViolationError('TEAM_PAWN_MOVE_INVALID');
          move(program, pending.actorId, selected, ctx);
          finishTurn(total, ctx);
        },
      }),
    },
    bot: {
      choose: ({ availableActions }) =>
        availableActions.includes(program.rollRecipe)
          ? { type: program.rollRecipe, payload: {} }
          : null,
    },
  });
}
function legalMoves(
  program: TeamPawnRaceOptions,
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
  program: TeamPawnRaceOptions,
  from: number,
  roll: number,
  arrival: number,
) {
  if (from >= arrival) return null;
  if (from < 0) return program.entryRolls.includes(roll) ? 0 : null;
  if (from >= program.trackLength) {
    const homeIndex = from - program.trackLength + 1;
    return homeIndex < program.homeLength &&
      roll === program.homeRolls[homeIndex - 1]
      ? from + 1
      : null;
  }
  const next = from + roll;
  return next > arrival || next > program.trackLength ? null : next;
}

function blocked(
  program: TeamPawnRaceOptions,
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
  program: TeamPawnRaceOptions,
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
  ctx.events.message(
    'game.team-pawn.moved',
    {
      playerId,
      pawnLabel: pawnLabel(program, selected.pawnId),
      distance: selected.distance,
      position: selected.to + 1,
      enteredTrack: selected.from < 0 && selected.to >= 0,
      originLabel:
        program.families.find((family) =>
          selected.pawnId.startsWith(`${family.id}:`),
        )?.habitat ?? 'enclos',
    },
    teamPawnMoveNarration(program, playerId, selected, ctx),
  );
}

function teamPawnMoveNarration(
  program: TeamPawnRaceOptions,
  playerId: number,
  selected: PawnMove,
  ctx: Context,
) {
  const pawn = pawnLabel(program, selected.pawnId) || 'le pion';
  const origin =
    program.families.find((family) =>
      selected.pawnId.startsWith(`${family.id}:`),
    )?.habitat ?? 'enclos';
  const position = selected.to + 1;
  const name = playerName(ctx, playerId);
  const entered = selected.from < 0 && selected.to >= 0;
  const distance = Math.abs(selected.distance);
  return {
    default: entered
      ? `${name} sort son ${pawn} de ${fromHabitat(origin)} et le place en case ${position}.`
      : `${name} déplace son ${pawn} de ${distance} case${distance === 1 ? '' : 's'} et le place en case ${position}.`,
    byPlayerId: {
      [playerId]: entered
        ? `Vous sortez votre ${pawn} de ${fromHabitat(origin)} et le placez en case ${position}.`
        : `Vous déplacez votre ${pawn} de ${distance} case${distance === 1 ? '' : 's'} et le placez en case ${position}.`,
    },
  };
}

function playerName(ctx: Context, playerId: number): string {
  return (
    ctx.players.all().find((player) => player.id === playerId)?.username ??
    `Joueur ${playerId}`
  );
}

function withDefiniteArticle(value: string): string {
  return /^[aeiouyéèêëàâîïôöùûü]/iu.test(value) ? `l’${value}` : `la ${value}`;
}

function fromHabitat(value: string): string {
  return /^[aeiouyéèêëàâîïôöùûü]/iu.test(value) ? `l’${value}` : `la ${value}`;
}

function capture(
  program: TeamPawnRaceOptions,
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
  program: TeamPawnRaceOptions,
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

function safeTiles(program: TeamPawnRaceOptions, ctx: Context) {
  return new Set([
    ...program.safeTiles,
    ...ctx.players.all().map((player) => playerOffset(program, player.id, ctx)),
  ]);
}

function pawns(program: TeamPawnRaceOptions, playerId: number, ctx: Context) {
  return ctx.pawns.assigned(program.setId, playerId).map((pawnId) => ({
    pawnId,
    progress: ctx.pawns.position(program.setId, pawnId),
  }));
}

function playerOffset(
  program: TeamPawnRaceOptions,
  playerId: number,
  ctx: Context,
) {
  const index = Math.max(
    0,
    ctx.players.all().findIndex((player) => player.id === playerId),
  );
  return program.startPositions[index];
}

function encode(move: PawnMove) {
  return `${move.pawnId}:${move.to}`;
}

function describe(
  program: TeamPawnRaceOptions,
  playerId: number,
  value: string,
  ctx: Context,
) {
  const parts = value.split(':');
  const pawnIndex = Number(parts.at(-2));
  const progress = Number(parts.at(-1));
  const pawnId = ctx.pawns.assigned(program.setId, playerId)[pawnIndex];
  return `${pawnLabel(program, pawnId) ?? `Pion ${pawnIndex + 1}`} vers la case ${progress + 1}`;
}

function pawnLabel(program: TeamPawnRaceOptions, pawnId: string | undefined) {
  const [familyId, rawIndex] = pawnId?.split(':') ?? [];
  const pawnIndex = Number(rawIndex);
  return (
    program.families.find((family) => family.id === familyId)?.pawns[
      pawnIndex
    ] ??
    pawnId ??
    'Pion'
  );
}
