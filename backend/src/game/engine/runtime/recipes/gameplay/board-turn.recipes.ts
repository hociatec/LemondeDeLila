import type { ChoiceResolverShape } from '../../contracts/author-rule-contracts';
import { boardChoices } from './board-choices';
import { boardEffectBindings } from './board-effect-bindings';
import type { BoardGameProgram } from '../../contracts/board-game-program';
import type { GameContext } from '../../definitions/game-author-context';
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { when } from '../../automation/automatic-kit';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { sequentialPawnSelection } from './pawn-selection.recipes';
import { drawAndResolve } from './card-dice.recipes';
import { BoardLandingResolver } from './board-landings';

type State = Record<string, never>;
type Context = GameContext<State>;
type Draw = { playerId: number; deckId: string };
type Card = {
  id: string;
  label?: string;
  effectDescription?: string;
  effects: readonly GameEffectInstruction[];
};

/** Compile a closed board program into handlers owned exclusively by the engine. */
export function boardTurnRules(source: BoardGameProgram) {
  const program = structuredClone(source);
  const resolvingFlag = `${program.namespace}.resolving-player`;
  const drawFlag = `${program.namespace}.pending-card-draw`;
  const board = new BoardLandingResolver<State>(program, drawFlag);
  const playing = (ctx: Context) =>
    ctx.phase.current() === program.playingPhase &&
    ctx.match.lifecycle() !== 'finished';
  const finish = (ctx: Context) => {
    if (
      ctx.choice.current() ||
      ctx.effects.isResolving() ||
      ctx.turn.flags.get(drawFlag) != null ||
      ctx.match.lifecycle() === 'finished' ||
      !ctx.turn.flags.consume(resolvingFlag)
    )
      return;
    ctx.turn.end();
  };
  const roll = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    available: ({ ctx }) =>
      playing(ctx) &&
      ctx.choice.current() == null &&
      ctx.turn.flags.get(drawFlag) == null,
    execute: ({ actor, ctx }) => {
      ctx.turn.flags.set(resolvingFlag, actor.id);
      const total = ctx.dice.roll(program.diceId).total;
      ctx.events.message('game.dice.rolled', {
        playerId: actor.id,
        diceId: program.diceId,
        total,
      });
      board.move(actor.id, total * ctx.turn.direction(), 0, ctx);
      finish(ctx);
    },
  });
  const draw = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    available: ({ actor, ctx }) =>
      playing(ctx) &&
      ctx.turn.flags.get<Draw>(drawFlag)?.playerId === actor.id &&
      ctx.choice.current() == null &&
      !ctx.effects.isResolving(),
    execute: ({ actor, ctx }) => {
      const pending = ctx.turn.flags.get<Draw>(drawFlag);
      if (!pending || pending.playerId !== actor.id)
        throw new GameRuleViolationError('BOARD_DRAW_NOT_PENDING');
      ctx.turn.flags.consume(drawFlag);
      drawAndResolve<State, Card>(ctx, {
        deckId: pending.deckId,
        playerId: actor.id,
        automatic: false,
        recycle: true,
        discard: true,
        eventData: (card) => ({
          revealed: true,
          cardLabel: card.label,
          effectDescription: card.effectDescription,
        }),
        resolve: (card) => ctx.effects.schedule(...card.effects),
      });
      finish(ctx);
    },
  });
  const choices = boardChoices(program, board, finish);
  const pawns = bindPawnSelection(program, choices);
  const setup = boardSetup(program, pawns);
  const effects = boardEffectBindings(program, board);
  const automatic = boardDirectionRestoration(program, playing);
  return { roll, draw, choices, setup, effects, automatic };
}

function bindPawnSelection(
  program: BoardGameProgram,
  choices: Record<string, ChoiceResolverShape<State>>,
) {
  const selection = program.pawnSelection;
  const pawns = selection
    ? sequentialPawnSelection<State>({
        setId: selection.setId,
        choiceId: selection.choiceId,
        assigned: ({ playerId, ctx }) => {
          const announcement = selection.announceInventory;
          if (announcement)
            ctx.events.emit(
              announcement.eventType,
              {
                playerId,
                items: ctx.inventory.items(announcement.inventoryId, playerId),
              },
              { kind: 'private', playerIds: [playerId] },
            );
        },
        complete: ({ ctx }) => {
          ctx.phase.transitionTo(program.playingPhase);
          const starter = ctx.round.starter();
          if (starter != null) ctx.turn.to(starter);
        },
      })
    : null;
  if (selection && pawns)
    choices[selection.choiceId] = defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
    });
  return pawns;
}

function boardSetup(
  program: BoardGameProgram,
  pawns: ReturnType<typeof bindPawnSelection>,
) {
  const setup = ({
    players,
    ctx,
  }: {
    players: ReturnType<Context['players']['all']>;
    ctx: Context;
  }): State => {
    const distribution = program.distribution;
    const groups = distribution ? ctx.random.shuffle(distribution.groups) : [];
    const starter =
      program.startingPlayer === 'random'
        ? (ctx.random.pick(players) ?? players[0])
        : players[0];
    if (!starter) throw new GameRuleViolationError('BOARD_PLAYERS_REQUIRED');
    ctx.round.start(starter.id);
    if (distribution)
      for (const [index, player] of players.entries()) {
        for (const item of groups[index % groups.length])
          ctx.inventory.add(distribution.inventoryId, player.id, item);
      }
    if (pawns)
      pawns.requestAll(
        players.map((player) => player.id),
        ctx,
      );
    else {
      if (ctx.phase.current() !== program.playingPhase)
        ctx.phase.transitionTo(program.playingPhase);
      ctx.turn.to(starter.id);
    }
    return {};
  };
  return setup;
}

function boardDirectionRestoration(
  program: BoardGameProgram,
  playing: (ctx: Context) => boolean,
) {
  const restoration = program.restoreDirection;
  const automatic = restoration
    ? [
        when<State>(
          restoration.ruleId,
          ({ ctx }) => {
            const current = ctx.players.current();
            return (
              playing(ctx) &&
              current != null &&
              ctx.status.has(current.id, restoration.status)
            );
          },
          ({ ctx }) => {
            const id = ctx.players.current()?.id;
            if (id != null) {
              ctx.status.remove(id, restoration.status);
              ctx.turn.reverse();
            }
          },
        ),
      ]
    : [];
  return automatic;
}
