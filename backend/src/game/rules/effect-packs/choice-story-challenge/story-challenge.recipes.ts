import {
  gameInput,
  cards,
  when,
  pawns,
  setupPlayingPhases,
  publicField,
  raceGame,
  sequentialPawnSelection,
} from '../../../engine/sdk/public-api';
import {
  defineChoice,
  defineEmptyAction,
} from '../../../engine/runtime/actions/action-builders';
import type { StoryChallengeProgram } from './program';
import { rejectRule } from '../../../core/domain/errors/game-domain.errors';
import { createStoryChallengeEffects } from './story-challenge-effects';
import { storyChallengeLaughterWinners } from './story-challenge-laughter';
import { createStoryChallengeResolution } from './story-challenge-resolution';

type State = Record<string, never>;

export function storyChallengeRules(source: StoryChallengeProgram) {
  const program = structuredClone(source);
  const phases = setupPlayingPhases<State>();
  const resolution = createStoryChallengeResolution(program);
  const pawnSelection = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      phases.transition(ctx, 'playing');
      const starterId = ctx.round.starter();
      if (starterId != null) ctx.turn.to(starterId);
    },
  });
  const roll = defineEmptyAction<State>({
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
        ? program.forcedRoll
        : ctx.dice.roll(program.diceId).total;
      if (
        value === program.forcedRoll &&
        ctx.status.consume(actor.id, program.statuses.replaceOne)
      )
        value = program.replacementRoll;
      ctx.events.message('game.dice.rolled', {
        playerId: actor.id,
        diceId: program.diceId,
        total: value,
      });
      if (
        ctx.resources.has(actor.id, program.resources.reroll, 1) &&
        value !== program.forcedRoll
      ) {
        ctx.choice.one({
          id: 'choice-story-challenge.reroll',
          player: actor.id,
          options: ['keep', 'reroll'],
          data: { kind: 'reroll', actorId: actor.id, roll: value },
          label: (choice) =>
            choice === 'keep'
              ? 'Garder ' + String(value)
              : 'Relancer le d\u00e9',
        });
        return;
      }
      resolution.applyRoll(state, actor.id, value, ctx);
      resolution.drainResolution(state, ctx);
    },
  });
  const choices = {
    [program.pawnChoiceId]: pawnSelection.choice,
    'choice-story-challenge.reroll': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'reroll', actor.id);
        let rollValue = pending.roll;
        if (value === 'reroll') {
          ctx.resources.remove(actor.id, program.resources.reroll, 1);
          rollValue = ctx.dice.roll(program.diceId).total;
          if (
            rollValue === program.forcedRoll &&
            ctx.status.consume(actor.id, program.statuses.replaceOne)
          )
            rollValue = program.replacementRoll;
          ctx.events.message('choice-story-challenge.reroll.used', {
            playerId: actor.id,
            total: rollValue,
          });
        }
        resolution.applyRoll(state, actor.id, rollValue, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'choice-story-challenge.option': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'option', actor.id);
        const rule = program.optionRules[pending.effect]?.find(
          (entry) => entry.id === value,
        );
        if (!rule) return rejectRule('Unknown option');
        if (rule.kind === 'move')
          resolution.moveAndResolve(state, actor.id, rule.delta, 0, ctx);
        else if (rule.kind === 'target')
          resolution.scheduleTarget(actor.id, rule.effect, ctx);
        else {
          const targetId =
            rule.target === 'actor' ? actor.id : pending.targetId;
          if (targetId == null) return rejectRule('Missing selected target');
          if (rule.consumeStatus)
            ctx.status.remove(actor.id, rule.consumeStatus);
          resolution.drawCard(state, targetId, rule.deck, 0, ctx);
        }
        resolution.drainResolution(state, ctx);
      },
    }),
    'choice-story-challenge.number': defineChoice<State, number>({
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
        for (const id of storyChallengeLaughterWinners(
          pending.order,
          pending.picks,
        ))
          resolution.moveAndResolve(state, id, program.numberAdvance, 0, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'choice-story-challenge.card': defineChoice<State, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'abundance', actor.id);
        const card = pending.cardIds.includes(value)
          ? program.decks[program.deckRoles.reward].find(
              (candidate) => candidate.id === value,
            )
          : null;
        if (!card) rejectRule('Carte StoryChallenge invalide');
        resolution.applyCard(state, actor.id, card, 0, ctx);
        resolution.drainResolution(state, ctx);
      },
    }),
    'choice-story-challenge.token': defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) => {
        const pending = resolution.requirePending(ctx, 'token', actor.id);
        if (!pending.tokens.includes(value))
          rejectRule('Objet StoryChallenge invalide');
        resolution.transferToken(pending.targetId, actor.id, value, ctx);
        ctx.events.message('choice-story-challenge.token.stolen', {
          playerId: actor.id,
          targetId: pending.targetId,
          token: value,
        });
        resolution.drainResolution(state, ctx);
      },
    }),
  };
  const deckComponents = Object.keys(program.decks).map((id) =>
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
    effects: createStoryChallengeEffects(program, resolution),
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
