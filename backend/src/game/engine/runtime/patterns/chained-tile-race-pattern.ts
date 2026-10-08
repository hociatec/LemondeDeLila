import { defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineActorEffect,
  defineEffect,
  defineEmptyEffect,
  drawAndResolve,
  drawEvent,
  sequentialPawnSelection,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type ChainedTileType = string;
export type ChainedTileRule = { description: string } & (
  | { kind: 'none' | 'finish' | 'choose-swap' | 'await-draw' }
  | { kind: 'move' | 'protected-move'; delta: number }
  | { kind: 'random-move'; maximum: number }
  | { kind: 'move-to'; position: number }
);
export type ChainedTileCard = {
  id: number;
  text: string;
  description: string;
  retreatScore: number;
  effects: readonly GameEffectInstruction[];
};
export type ChainedTileRaceProgram = {
  rollRecipe: string;
  drawRecipe: string;
  tileRules: Readonly<Record<string, ChainedTileRule>>;
  finishReason: string;
  selectionDrawCount: number;
  trackId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  deckId: string;
  diceId: string;
  trapImmunityStatusId: string;
  awaitingCardStatusId: string;
  cards: readonly ChainedTileCard[];
  pawns: readonly { id: string; label: string; description: string }[];
  tiles: readonly {
    type: ChainedTileType;
    label: string;
    description?: string;
  }[];
  maxResolutionDepth: number;
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = ChainedTileRaceProgram['cards'][number];

export function chainedTileRace(source: ChainedTileRaceProgram) {
  const program: ChainedTileRaceProgram = {
    ...structuredClone(source),
    tiles: source.tiles.map((tile) => ({
      ...structuredClone(tile),
      description: tile.description || source.tileRules[tile.type].description,
    })),
  };
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    completePhase: 'playing',
  });
  const roll = defineEmptyAction<State>({
    documentation: 'Lance le dé et résout la chaîne de cases et de cartes.',
    available: ({ state, actor, ctx }) =>
      ctx.phase.current() === 'playing' &&
      !awaiting(program, actor.id, state, ctx),
    execute: ({ state, actor, ctx }) => {
      const turnNumber = ctx.turn.number();
      const total = ctx.dice.roll(program.diceId).total;
      ctx.events.message('game.dice.rolled', {
        playerId: actor.id,
        diceId: program.diceId,
        total,
      });
      moveBy(program, state, actor.id, total, 0, ctx);
      if (
        ctx.turn.number() === turnNumber &&
        !awaiting(program, actor.id, state, ctx)
      )
        ctx.turn.complete();
    },
  });
  const draw = defineEmptyAction<State>({
    ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
    documentation: 'Pioche la carte demandée par une case Folie loufoque.',
    available: ({ state, actor, ctx }) =>
      ctx.phase.current() === 'playing' &&
      ctx.players.current()?.id === actor.id &&
      awaiting(program, actor.id, state, ctx),
    execute: ({ state, actor, ctx }) => {
      const turnNumber = ctx.turn.number();
      if (Reflect.has(state, 'awaitingCardDraw'))
        Reflect.set(state, 'awaitingCardDraw', false);
      for (const player of ctx.players.all())
        ctx.status.remove(player.id, program.awaitingCardStatusId);
      drawCard(program, actor.id, ctx);
      if (
        ctx.turn.number() === turnNumber &&
        !awaiting(program, actor.id, state, ctx)
      )
        ctx.turn.complete();
    },
  });
  return definePattern({
    id: `chained-tile-race:${program.trackId}`,
    mechanics: ['race', 'cards', 'pawns', 'effects'],
    actions: {
      [program.rollRecipe]: roll,
      [program.drawRecipe]: draw,
    },
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: pawns.choice,
    },
    effects: effects(program),
    bot: {
      choose: ({ availableActions }) => {
        const type = [program.drawRecipe, program.rollRecipe].find((recipe) =>
          availableActions.includes(recipe),
        );
        return type ? { type, payload: {} } : null;
      },
    },
  });
}
function awaiting(
  program: ChainedTileRaceProgram,
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
  program: ChainedTileRaceProgram,
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
  program: ChainedTileRaceProgram,
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
  program: ChainedTileRaceProgram,
  state: State,
  playerId: number,
  position: number,
  depth: number,
  ctx: Context,
) {
  const tile = program.tiles[position];
  if (!tile) return;
  const rule = program.tileRules[tile.type];
  if (rule.kind === 'finish')
    ctx.match.finish({ winners: [playerId], reason: program.finishReason });
  else if (rule.kind === 'move') {
    ctx.events.message('game.pawn.bonus-advance', {
      playerId,
      spaces: rule.delta,
    });
    moveBy(program, state, playerId, rule.delta, depth, ctx);
  } else if (rule.kind === 'protected-move') {
    if (ctx.status.has(playerId, program.trapImmunityStatusId))
      ctx.events.message('race-chained-tile-cards.trap.ignored', { playerId });
    else moveBy(program, state, playerId, rule.delta, depth, ctx);
  } else if (rule.kind === 'random-move') {
    const magnitude = ctx.random.int(rule.maximum) + 1;
    const direction = ctx.random.int(2) === 0 ? 1 : -1;
    const distance = magnitude * direction;
    ctx.events.message('game.pawn.bonus-advance', {
      playerId,
      spaces: distance,
    });
    moveBy(program, state, playerId, distance, depth, ctx);
  } else if (rule.kind === 'choose-swap') {
    ctx.effects.schedule(
      {
        kind: 'custom',
        effectId: 'race-chained-tile-cards.swap',
        data: {},
        target: {
          kind: 'chosen-opponent',
          choiceId: 'race-chained-tile-cards.swap',
          optional: false,
          requireExplicitChoice: true,
        },
      },
      { kind: 'complete-turn' },
    );
  } else if (rule.kind === 'move-to')
    moveTo(program, state, playerId, rule.position, depth + 1, ctx);
  else if (rule.kind === 'await-draw') {
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

function drawCard(
  program: ChainedTileRaceProgram,
  playerId: number,
  ctx: Context,
) {
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    eventData: (card) => announcement(card),
    resolve: (card) => ctx.effects.schedule(...endOfTurnCardEffects(card)),
  });
}

function endOfTurnCardEffects(card: Card): readonly GameEffectInstruction[] {
  // The draw action ends immediately after resolution, so its final tick must
  // not consume one of the future turns promised by the card text.
  return card.effects.map((effect) =>
    effect.kind === 'add-status' &&
    effect.scope === 'turn' &&
    effect.turns != null
      ? { ...effect, turns: effect.turns + 1 }
      : effect,
  );
}

function announcement(card: Card): Record<string, unknown> {
  const separator = card.text.indexOf(':');
  const label = (
    separator >= 0 ? card.text.slice(0, separator) : card.text
  ).trim();
  return {
    revealed: true,
    cardLabel: `${label} : ${card.description.trim()}`,
    effectDescription: (separator >= 0
      ? card.text.slice(separator + 1)
      : card.text
    ).trim(),
  };
}

function effects(program: ChainedTileRaceProgram) {
  return {
    'race-chained-tile-cards.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ state, targetPlayerIds, data, ctx }) => {
        for (const playerId of targetPlayerIds)
          moveBy(program, state, playerId, data.delta, 0, ctx);
      },
    }),
    'race-chained-tile-cards.next-tile': defineEffect<State, { tile: string }>({
      input: gameInput.object({
        tile: gameInput.enum(Object.keys(program.tileRules)),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        const current = ctx.movement.position(program.trackId, actorPlayerId);
        const next = program.tiles.findIndex(
          (tile, index) => index > current && tile.type === data.tile,
        );
        if (next >= 0) moveTo(program, state, actorPlayerId, next, 1, ctx);
      },
    }),
    'race-chained-tile-cards.repeat-roll': defineEmptyEffect<State>(
      ({ state, targetPlayerIds, ctx }) => {
        const delta = ctx.dice.last(program.diceId)?.total ?? 0;
        for (const playerId of targetPlayerIds)
          moveBy(program, state, playerId, delta, 0, ctx);
      },
    ),
    'race-chained-tile-cards.swap': defineEmptyEffect<State>(
      ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const target = targetPlayerIds[0];
        if (actorPlayerId == null || target == null) return;
        ctx.events.message('game.positions.swapped', {
          actorId: actorPlayerId,
          targetId: target,
        });
        ctx.movement.swap(program.trackId, actorPlayerId, target);
      },
    ),
    'race-chained-tile-cards.go-to': defineEffect<State, { position: number }>({
      input: gameInput.object({
        position: gameInput.number({ integer: true, min: 0 }),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          moveTo(program, state, actorPlayerId, data.position, 0, ctx);
      },
    }),
    'race-chained-tile-cards.boutique': defineActorEffect<State>(
      ({ actorPlayerId, ctx }) => boutique(program, actorPlayerId, ctx),
    ),
    'race-chained-tile-cards.random-move': defineEmptyEffect<State>(
      ({ state, targetPlayerIds, ctx }) => {
        for (const playerId of targetPlayerIds) {
          const distance = ctx.random.int(2) === 0 ? -1 : 1;
          ctx.events.message('game.pawn.bonus-advance', {
            playerId,
            spaces: distance,
          });
          moveBy(program, state, playerId, distance, 0, ctx);
        }
      },
    ),
    'race-chained-tile-cards.finish-if-slide': defineEmptyEffect<State>(
      ({ state, actorPlayerId, ctx }) => {
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
    ),
  };
}

function boutique(
  program: ChainedTileRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const cards = Array.from({ length: program.selectionDrawCount })
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
  ctx.events.message('race-chained-tile-cards.shop.card-selected', {
    playerId,
    cardId: selected.id,
  });
  ctx.effects.schedule(...endOfTurnCardEffects(selected));
}
