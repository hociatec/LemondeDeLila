import {
  defineAction,
  defineEffect,
  gameEffects,
  gameInput,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { MAMAN_CONTENT } from './content';
import type {
  MamanCard,
  MamanTileType,
  ToutPresDeMamanState,
} from './state';

const TRACK = 'forest';
const DECK = 'events';
const TOKENS_TO_WIN = 3;
const MAX_DEPTH = 12;
const TOKEN = 'eucalyptus';
const BONUS_REROLL = 'maman.bonus-reroll';

type RuleContext = GameContext<ToutPresDeMamanState>;

export const roll = defineAction<ToutPresDeMamanState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout la chaîne d’effets de la forêt.',
  execute: ({ state, actor, ctx }) => {
    const extraDice = ctx.status.consume(actor.id, BONUS_REROLL) ? 1 : 0;
    const total = ctx.dice.rollWith('main', { extraDice }).total;
    const current = ctx.movement.position(TRACK, actor.id);
    const last = MAMAN_CONTENT.tiles.length - 1;
    const rawTarget = current + total;
    const target =
      rawTarget > last ? Math.max(0, last - (rawTarget - last)) : rawTarget;
    setPosition(actor.id, target, ctx);
    ctx.events.message('game.pawn.moved', {
      playerId: actor.id,
      distance: total,
      target,
    });
    applyTile(state, actor.id, target, 0, ctx);
    if (ctx.match.lifecycle() !== 'finished' && ctx.choice.current() == null) {
      ctx.turn.end();
    }
  },
});

export const TOUT_PRES_DE_MAMAN_ACTIONS = { roll };

function applyTile(
  state: ToutPresDeMamanState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.choice.current() != null) return;
  const tile = MAMAN_CONTENT.tiles[position];
  if (!tile) return;
  if (tile.type === 'start') gainTokens(playerId, 2, ctx);
  else if (tile.type === 'token') gainTokens(playerId, 1, ctx);
  else if (tile.type === 'card')
    drawAndApplyCard(playerId, ctx);
  else if (tile.type === 'bonds')
    moveAndApply(state, playerId, 2, depth + 1, ctx);
  else if (tile.type === 'slide')
    moveAndApply(state, playerId, -2, depth + 1, ctx);
  else if (tile.type === 'storm' || tile.type === 'nest')
    ctx.turn.skip(playerId, 1);
  else if (tile.type === 'meeting')
    ctx.effects.schedule(
      gameEffects.custom(
        'maman.meeting',
        {},
        gameEffects.target.chosenOpponent('maman.meeting'),
      ),
      gameEffects.completeTurn(),
    );
  else if (tile.type === 'finish')
    finishOrRewind(state, playerId, position, depth + 1, ctx);
}

function drawAndApplyCard(
  playerId: number,
  ctx: RuleContext,
): void {
  ctx.cards.drawThenResolve<MamanCard, void>(
    DECK,
    (card) => {
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: DECK,
        cardId: card.id,
      });
      ctx.effects.schedule(...card.effects);
    },
    {},
  );
}

function moveAndApply(
  state: ToutPresDeMamanState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (ctx.choice.current() != null) return;
  const position = ctx.movement.move(TRACK, playerId, delta);
  applyTile(state, playerId, position, depth, ctx);
}

function moveToType(
  state: ToutPresDeMamanState,
  playerId: number,
  type: MamanTileType,
  direction: 1 | -1,
  depth: number,
  ctx: RuleContext,
): void {
  const current = ctx.movement.position(TRACK, playerId);
  let index = current + direction;
  while (index >= 0 && index < MAMAN_CONTENT.tiles.length) {
    if (MAMAN_CONTENT.tiles[index].type === type) {
      setPosition(playerId, index, ctx);
      applyTile(state, playerId, index, depth, ctx);
      return;
    }
    index += direction;
  }
}

function finishOrRewind(
  state: ToutPresDeMamanState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  const tokens = ctx.resources.get(playerId, TOKEN);
  if (tokens >= TOKENS_TO_WIN) {
    ctx.match.finish({ winners: [playerId], reason: 'maman-found' });
    return;
  }
  const rewind = Math.min(position, TOKENS_TO_WIN - tokens);
  setPosition(playerId, position - rewind, ctx);
  applyTile(state, playerId, position - rewind, depth, ctx);
}

function setPosition(
  playerId: number,
  position: number,
  ctx: RuleContext,
): void {
  const current = ctx.movement.position(TRACK, playerId);
  ctx.movement.move(TRACK, playerId, position - current);
}

function gainTokens(
  playerId: number,
  amount: number,
  ctx: RuleContext,
): void {
  ctx.resources.add(playerId, TOKEN, amount);
}

export const MAMAN_EFFECTS = {
  'maman.move': defineEffect<ToutPresDeMamanState, { delta: number }>({
    input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
    apply: ({ state, targetPlayerIds, data, ctx }) => {
      for (const playerId of targetPlayerIds) {
        if (ctx.choice.current() == null) {
          moveAndApply(state, playerId, data.delta, 0, ctx);
        }
      }
    },
  }),
  'maman.move-to-type': defineEffect<
    ToutPresDeMamanState,
    {
      type: 'card' | 'token' | 'bonds';
      direction: 'forward' | 'backward';
    }
  >({
    input: gameInput.object({
      type: gameInput.enum(['card', 'token', 'bonds'] as const),
      direction: gameInput.enum(['forward', 'backward'] as const),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveToType(
          state,
          actorPlayerId,
          data.type,
          data.direction === 'forward' ? 1 : -1,
          0,
          ctx,
        );
      }
    },
  }),
  'maman.transfer-token': defineEffect<
    ToutPresDeMamanState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (
        actorPlayerId != null &&
        targetId != null &&
        ctx.resources.has(actorPlayerId, TOKEN, 1)
      ) {
        ctx.resources.transfer(actorPlayerId, targetId, TOKEN, 1);
      }
    },
  }),
  'maman.share-advance': defineEffect<
    ToutPresDeMamanState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (targetId != null) moveAndApply(state, targetId, 1, 0, ctx);
    },
  }),
  'maman.meeting': defineEffect<
    ToutPresDeMamanState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, targetPlayerIds, ctx }) => {
      const targetId = targetPlayerIds[0];
      if (actorPlayerId != null) moveAndApply(state, actorPlayerId, 1, 0, ctx);
      if (targetId != null && ctx.match.lifecycle() !== 'finished') {
        moveAndApply(state, targetId, 1, 0, ctx);
      }
    },
  }),
  'maman.roll-move': defineEffect<
    ToutPresDeMamanState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (actorPlayerId != null) {
        moveAndApply(state, actorPlayerId, ctx.dice.roll('main').total, 0, ctx);
      }
    },
  }),
  'maman.roll-threshold-move': defineEffect<
    ToutPresDeMamanState,
    Record<string, never>
  >({
    input: gameInput.object({}),
    apply: ({ state, actorPlayerId, ctx }) => {
      if (actorPlayerId != null && ctx.dice.roll('main').total >= 4) {
        moveAndApply(state, actorPlayerId, 1, 0, ctx);
      }
    },
  }),
} as const;
