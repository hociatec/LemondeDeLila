import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-kit';
import type { ContesProgram } from '../../extensions/contes/program';
import { when } from '../../automation/automatic-kit';
import { pawns } from '../../kits/pawn-kit';
import { setupPlayingPhases } from '../../kits/phase-kit';
import { publicField } from '../../kits/visibility-kit';
import { raceGame } from '../../patterns/gameplay-pattern-track-card';
import { sequentialPawnSelection } from './pawn-selection.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import { createContesEffects } from './contes-effects';
import { contesLaughterWinners } from './contes-laughter';
import { createContesResolution } from './contes-resolution';

type State = Record<string, never>;

export function contesRules(source: ContesProgram) {
  const program = structuredClone(source);
  const phases = setupPlayingPhases<State>();
  const resolution = createContesResolution(program);
  const pawnSelection = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      phases.transition(ctx, 'playing');
      const starterId = ctx.round.starter();
      if (starterId != null) ctx.turn.to(starterId);
    },
  });
  const roll = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    documentation:
      'Lance le dé, applique les objets et résout intégralement la case atteinte.',
    available: ({ ctx }) =>
      phases.is(ctx, 'playing') &&
      ctx.choice.current() == null &&
      ctx.match.lifecycle() !== 'finished',
    execute: ({ state, actor, ctx }) => {
      ctx.turn.flags.set(program.resolutionFlag, {
        playerId: actor.id,
        types: [],
      });
      let value = ctx.status.has(actor.id, program.statuses.forcedOne)
        ? 1
        : ctx.dice.roll('main').total;
      if (
        value === 1 &&
        ctx.status.consume(actor.id, program.statuses.replaceOne)
      )
        value = 4;
      ctx.events.message('game.dice.rolled', {
        playerId: actor.id,
        diceId: 'main',
        total: value,
      });
      if (
        ctx.resources.has(actor.id, program.resources.reroll, 1) &&
        value !== 1
      ) {
        ctx.choice.one({
          id: 'contes.reroll',
          player: actor.id,
          options: ['keep', 'reroll'],
          data: { kind: 'reroll', actorId: actor.id, roll: value },
          label: (choice) =>
            choice === 'keep'
              ? 'Garder ' + String(value)
              : 'Utiliser le parchemin',
        });
        return;
      }
      resolution.applyRoll(state, actor.id, value, ctx);
      resolution.drainResolution(state, ctx);
    },
  });
  const choices = {
    [program.pawnChoiceId]: defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) =>
        pawnSelection.resolve(actor.id, value, ctx),
    }),
    'contes.reroll': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'reroll', actor.id);
        let rollValue = pending.roll;
        if (value === 'reroll') {
          ctx.resources.remove(actor.id, program.resources.reroll, 1);
          rollValue = ctx.dice.roll('main').total;
          if (
            rollValue === 1 &&
            ctx.status.consume(actor.id, program.statuses.replaceOne)
          )
            rollValue = 4;
          ctx.events.message('contes.reroll.used', {
            playerId: actor.id,
            total: rollValue,
          });
        }
        resolution.applyRoll(state, actor.id, rollValue, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'contes.option': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'option', actor.id);
        if (pending.effect === 'song') {
          if (value === 'move-three')
            resolution.moveAndResolve(state, actor.id, 3, 0, ctx);
          else resolution.scheduleTarget(actor.id, 'song-steal', ctx);
        } else if (pending.effect === 'wish') {
          if (value === 'move-two')
            resolution.moveAndResolve(state, actor.id, 2, 0, ctx);
          else if (value === 'swap')
            resolution.scheduleTarget(actor.id, 'wish-swap', ctx);
          else resolution.drawCard(state, actor.id, 'bonus', 0, ctx);
        } else {
          const targetId = pending.targetId;
          if (targetId == null) rejectRule('Cible de la Clé d’or absente');
          ctx.status.remove(actor.id, program.statuses.keyOfGold);
          resolution.drawCard(
            state,
            targetId,
            value === 'bonus' ? 'bonus' : 'malus',
            0,
            ctx,
          );
        }
        resolution.drainResolution(state, ctx);
      },
    }),
    'contes.number': defineChoice<State, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'laughter', actor.id);
        pending.picks[actor.id] = value;
        const nextId = pending.order.find((id) => pending.picks[id] == null);
        if (nextId != null) {
          pending.actorId = nextId;
          resolution.requestNumber(nextId, ctx, pending);
          return;
        }
        for (const id of contesLaughterWinners(pending.order, pending.picks))
          resolution.moveAndResolve(state, id, 1, 0, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'contes.card': defineChoice<State, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'abundance', actor.id);
        const card = pending.cardIds.includes(value)
          ? program.decks.bonus.find((candidate) => candidate.id === value)
          : null;
        if (!card) rejectRule('Carte Contes invalide');
        resolution.applyCard(state, actor.id, card, 0, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'contes.token': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'token', actor.id);
        if (!pending.tokens.includes(value))
          rejectRule('Objet Contes invalide');
        resolution.transferToken(pending.targetId, actor.id, value, ctx);
        ctx.events.message('contes.token.stolen', {
          playerId: actor.id,
          targetId: pending.targetId,
          token: value,
        });
        resolution.drainResolution(state, ctx);
      },
    }),
  };
  const deckComponents = (['bonus', 'malus', 'surprise', 'conte'] as const).map(
    (id) =>
      cards.deck({
        id,
        cards: program.decks[id],
        shuffle: true,
        empty: 'recycle',
      }),
  );
  const automatic = [
    when<State>(
      'unblock-passed-player',
      ({ ctx }) => {
        const player = ctx.players.current();
        const blocked = player
          ? resolution.blockedPosition(ctx, player.id)
          : null;
        return (
          phases.is(ctx, 'playing') &&
          player != null &&
          blocked != null &&
          ctx.players
            .all()
            .some(
              (other) =>
                other.id !== player.id &&
                ctx.movement.position(program.trackId, other.id) >= blocked,
            )
        );
      },
      ({ ctx }) => {
        const current = ctx.players.current();
        if (!current) return;
        const blocker = resolution.blockedPosition(ctx, current.id);
        if (blocker == null) return;
        const passed = ctx.players
          .all()
          .some(
            (player) =>
              player.id !== current.id &&
              ctx.movement.position(program.trackId, player.id) >= blocker,
          );
        if (passed) ctx.status.remove(current.id, program.statuses.blocked);
      },
    ),
    when<State>(
      'skip-sleeping-or-blocked-player',
      ({ ctx }) => {
        const player = ctx.players.current();
        return (
          phases.is(ctx, 'playing') &&
          player != null &&
          resolution.blockedPosition(ctx, player.id) != null
        );
      },
      ({ ctx }) => {
        const player = ctx.players.current();
        if (!player) return;
        ctx.events.message('game.player.passed', { playerId: player.id });
        ctx.turn.complete();
      },
    ),
  ];
  return {
    roll,
    choices,
    setup: pawnSelection.setup(() => ({})),
    effects: createContesEffects(program, resolution),
    automatic,
    patterns: [
      raceGame<State>({
        trackId: program.trackId,
        spaces: program.tiles.length,
        overshoot: 'bounce',
      }),
    ],
    components: [
      pawns.set({ id: program.pawnSetId, pawns: program.pawns }),
      ...deckComponents,
    ],
    playerValuesVisibility: { statuses: publicField() },
  };
}
