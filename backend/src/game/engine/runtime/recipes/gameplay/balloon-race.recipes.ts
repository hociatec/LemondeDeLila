import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type { BalloonRaceProgram } from '../../extensions/balloon-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import { drawAndResolve, drawEvent } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = BalloonRaceProgram['cards'][number];

export function balloonRaceRules(source: BalloonRaceProgram) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo('playing');
      const starter = ctx.round.starter();
      if (starter != null) ctx.turn.to(starter);
    },
  });
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Lance le dé et résout la chaîne de cases et de cartes.',
      available: ({ state, actor, ctx }) =>
        ctx.phase.current() === 'playing' &&
        !awaiting(program, actor.id, state, ctx),
      execute: ({ state, actor, ctx }) => {
        const total = ctx.dice.roll(program.diceId).total;
        ctx.events.message('game.dice.rolled', {
          playerId: actor.id,
          diceId: program.diceId,
          total,
        });
        moveBy(program, state, actor.id, total, 0, ctx);
        if (!awaiting(program, actor.id, state, ctx)) ctx.turn.complete();
      },
    }),
    draw: defineAction<State, Record<string, never>>({
      ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
      input: gameInput.object({}),
      documentation: 'Pioche la carte demandée par une case Folie loufoque.',
      available: ({ state, actor, ctx }) =>
        ctx.phase.current() === 'playing' &&
        ctx.players.current()?.id === actor.id &&
        awaiting(program, actor.id, state, ctx),
      execute: ({ state, actor, ctx }) => {
        if (Reflect.has(state, 'awaitingCardDraw'))
          Reflect.set(state, 'awaitingCardDraw', false);
        for (const player of ctx.players.all())
          ctx.status.remove(player.id, program.awaitingCardStatusId);
        drawCard(program, actor.id, ctx);
        if (!awaiting(program, actor.id, state, ctx)) ctx.turn.complete();
      },
    }),
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
    },
    effects: effects(program),
  };
}
function awaiting(
  program: BalloonRaceProgram,
  playerId: number,
  state: State,
  ctx: Context,
) {
  return (
    Reflect.get(state, 'awaitingCardDraw') === true ||
    ctx.status.has(playerId, program.awaitingCardStatusId)
  );
}

function moveBy(
  program: BalloonRaceProgram,
  state: State,
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
) {
  if (
    depth > program.maxResolutionDepth ||
    ctx.match.lifecycle() === 'finished'
  )
    return;
  ctx.movement.moveAndResolve({
    trackId: program.trackId,
    playerId,
    distance: delta,
    tiles: program.tiles,
    depth: depth + 1,
    maxDepth: program.maxResolutionDepth,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position }) =>
      land(program, state, playerId, position, depth + 1, ctx),
  });
}

function moveTo(
  program: BalloonRaceProgram,
  state: State,
  playerId: number,
  target: number,
  depth: number,
  ctx: Context,
) {
  if (
    depth > program.maxResolutionDepth ||
    ctx.match.lifecycle() === 'finished'
  )
    return;
  ctx.movement.moveAndResolve({
    trackId: program.trackId,
    playerId,
    distance: target - ctx.movement.position(program.trackId, playerId),
    tiles: program.tiles,
    depth,
    maxDepth: program.maxResolutionDepth,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position }) =>
      land(program, state, playerId, position, depth, ctx),
  });
}

function land(
  program: BalloonRaceProgram,
  state: State,
  playerId: number,
  position: number,
  depth: number,
  ctx: Context,
) {
  const tile = program.tiles[position];
  if (!tile) return;
  if (tile.type === 'finish')
    ctx.match.finish({ winners: [playerId], reason: 'golden-nut' });
  else if (tile.type === 'bonus') {
    ctx.events.message('game.pawn.bonus-advance', { playerId, spaces: 2 });
    moveBy(program, state, playerId, 2, depth, ctx);
  } else if (tile.type === 'piege') {
    if (ctx.status.has(playerId, program.trapImmunityStatusId))
      ctx.events.message('a-fond-les-ballons.trap.ignored', { playerId });
    else moveBy(program, state, playerId, -2, depth, ctx);
  } else if (tile.type === 'glissade') {
    const magnitude = ctx.random.int(3) + 1;
    const direction = ctx.random.int(2) === 0 ? 1 : -1;
    moveBy(program, state, playerId, magnitude * direction, depth, ctx);
  } else if (tile.type === 'tornade') {
    ctx.effects.schedule(
      {
        kind: 'custom',
        effectId: 'a-fond-les-ballons.swap',
        data: {},
        target: {
          kind: 'chosen-opponent',
          choiceId: 'a-fond-les-ballons.swap',
          optional: false,
        },
      },
      { kind: 'complete-turn' },
    );
  } else if (tile.type === 'chaton')
    moveTo(program, state, playerId, 0, depth + 1, ctx);
  else if (tile.type === 'folie') {
    if (Reflect.has(state, 'awaitingCardDraw'))
      Reflect.set(state, 'awaitingCardDraw', true);
    else
      for (const player of ctx.players.all())
        if (!ctx.status.has(player.id, program.awaitingCardStatusId))
          ctx.status.add(player.id, program.awaitingCardStatusId, {
            scope: 'match',
          });
    ctx.events.message('game.card.draw-required', { playerId });
  }
}

function drawCard(program: BalloonRaceProgram, playerId: number, ctx: Context) {
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    eventData: (card) => announcement(card),
    resolve: (card) => ctx.effects.schedule(...card.effects),
  });
}

function announcement(card: Card): Record<string, unknown> {
  const separator = card.text.indexOf(':');
  return {
    revealed: true,
    cardLabel: (separator >= 0
      ? card.text.slice(0, separator)
      : card.text
    ).trim(),
    effectDescription: (separator >= 0
      ? card.text.slice(separator + 1)
      : card.text
    ).trim(),
  };
}

function effects(program: BalloonRaceProgram) {
  return {
    'a-fond-les-ballons.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          moveBy(program, state, playerId, data.delta, 0, ctx);
      },
    }),
    'a-fond-les-ballons.next-tile': defineEffect<
      State,
      { tile: 'bonus' | 'folie' }
    >({
      input: gameInput.object({ tile: gameInput.enum(['bonus', 'folie']) }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        const current = ctx.movement.position(program.trackId, actorPlayerId);
        const next = program.tiles.findIndex(
          (tile, index) => index > current && tile.type === data.tile,
        );
        if (next >= 0) moveTo(program, state, actorPlayerId, next, 1, ctx);
      },
    }),
    'a-fond-les-ballons.repeat-roll': defineEffect<
      State,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ state, targetPlayerIds, ctx }) => {
        const delta = ctx.dice.last(program.diceId)?.total ?? 0;
        for (const playerId of targetPlayerIds)
          moveBy(program, state, playerId, delta, 0, ctx);
      },
    }),
    'a-fond-les-ballons.swap': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId == null || target == null) return;
        ctx.movement.swap(program.trackId, actorPlayerId, target);
        ctx.events.message('game.positions.swapped', {
          actorId: actorPlayerId,
          targetId: target,
        });
      },
    }),
    'a-fond-les-ballons.go-to': defineEffect<State, { position: number }>({
      input: gameInput.object({
        position: gameInput.number({ integer: true, min: 0 }),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveTo(program, state, actorPlayerId, data.position, 0, ctx);
      },
    }),
    'a-fond-les-ballons.boutique': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null) boutique(program, actorPlayerId, ctx);
      },
    }),
    'a-fond-les-ballons.random-move': defineEffect<
      State,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ state, targetPlayerIds, ctx }) => {
        for (const playerId of targetPlayerIds)
          moveBy(
            program,
            state,
            playerId,
            ctx.random.int(2) === 0 ? -1 : 1,
            0,
            ctx,
          );
      },
    }),
    'a-fond-les-ballons.finish-if-slide': defineEffect<
      State,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ state, actorPlayerId, ctx }) => {
        if (
          actorPlayerId != null &&
          program.tiles[ctx.movement.position(program.trackId, actorPlayerId)]
            ?.type === 'glissade'
        )
          moveTo(
            program,
            state,
            actorPlayerId,
            program.tiles.length - 1,
            0,
            ctx,
          );
      },
    }),
  };
}

function boutique(program: BalloonRaceProgram, playerId: number, ctx: Context) {
  const cards = [0, 1]
    .map(() =>
      drawEvent<State, Card>(ctx, {
        deckId: program.deckId,
        playerId,
        recycle: true,
      }),
    )
    .filter((card): card is Card => card != null);
  const selected = cards
    .map((card, drawIndex) => ({ card, drawIndex }))
    .sort(
      (left, right) =>
        left.card.retreatScore - right.card.retreatScore ||
        left.drawIndex - right.drawIndex,
    )[0]?.card;
  if (!selected) return;
  ctx.events.message('a-fond-les-ballons.shop.card-selected', {
    playerId,
    cardId: selected.id,
  });
  ctx.effects.schedule(...selected.effects);
}
