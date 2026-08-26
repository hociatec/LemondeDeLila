import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { MISSION_GALAXIE_CONTENT } from './content';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieEventCard,
  MissionGalaxieState,
} from './state';

type RuleContext = GameRuleContext<MissionGalaxieState>;
const TRACK = 'galaxy';
const MAX_EFFECT_DEPTH = 20;

export const roll = defineAction<MissionGalaxieState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout entièrement la case galactique.',
  execute: ({ state, actor, ctx }) => {
    const total = ctx.dice.roll('main').total;
    state.lastRoll = total;
    ctx.history.add(`${actor.username} lance le dé : « ${total} ».`);
    const next = ctx.movement.move(TRACK, actor.id, total);
    resolveLanding(state, actor.id, next, 0, ctx);
    completeTurn(state, ctx);
  },
});

export const MISSION_GALAXIE_ACTIONS = { roll };

export function resolveMissionChoice(
  state: MissionGalaxieState,
  value: unknown,
  ctx: RuleContext,
): void {
  const pending = state.pendingChoice;
  if (!pending) throw new Error('Choix Mission Galaxie introuvable');
  state.pendingChoice = null;
  if (pending.kind === 'answer') {
    const choiceIndex = Number(value);
    const delta =
      choiceIndex === pending.card.correctIndex
        ? pending.card.correctDelta
        : pending.card.wrongDelta;
    moveAndLand(state, pending.actorId, delta, 0, ctx);
  } else {
    const selected = String(value);
    const option = pending.options.find(
      (candidate) => encodeMove(candidate) === selected,
    );
    if (!option) throw new Error('Mouvement galactique invalide');
    moveAndLand(state, option.targetId, option.delta, 0, ctx);
  }
  completeTurn(state, ctx);
}

export function skipMissionPlayer(
  state: MissionGalaxieState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} saute son tour.`);
  ctx.turn.end();
}

function resolveLanding(
  state: MissionGalaxieState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (
    depth > MAX_EFFECT_DEPTH ||
    state.pendingChoice ||
    state.winnerId != null
  ) {
    return;
  }
  const tile = MISSION_GALAXIE_CONTENT.tiles[position];
  if (!tile) return;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} atteint « ${tile.title} ».`,
  );
  if (tile.type === 'move' && tile.delta) {
    moveAndLand(state, playerId, tile.delta, depth + 1, ctx);
  } else if (tile.type === 'skip') {
    state.skipTurns[playerId] += tile.skipTurns ?? 1;
  } else if (tile.type === 'question' || tile.type === 'challenge') {
    drawChoiceCard(
      state,
      playerId,
      tile.type === 'question' ? 'questions' : 'challenges',
      ctx,
    );
  } else if (tile.type === 'event') {
    drawEvent(state, playerId, depth + 1, ctx);
  } else if (tile.type === 'swapNearest') {
    swapNearest(playerId, ctx);
  } else if (tile.type === 'goto' && tile.target != null) {
    setPosition(playerId, tile.target - 1, ctx);
    resolveLanding(state, playerId, tile.target - 1, depth + 1, ctx);
  } else if (tile.type === 'finish') {
    state.winnerId = playerId;
  }
  if (tile.keepTurn && state.winnerId == null) ctx.turn.extra();
}

function drawChoiceCard(
  state: MissionGalaxieState,
  playerId: number,
  deck: 'questions' | 'challenges',
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<MissionGalaxieChoiceCard>(deck);
  if (!card) return;
  ctx.cards.discard(deck, card);
  state.pendingChoice = { kind: 'answer', actorId: playerId, card };
  ctx.choice.one({
    id: 'mission-galaxie.choice',
    player: playerId,
    options: card.choices.map((_choice, index) => index),
    label: (index) => card.choices[index],
  });
}

function drawEvent(
  state: MissionGalaxieState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<MissionGalaxieEventCard>('events');
  if (!card) return;
  ctx.cards.discard('events', card);
  ctx.history.add(`Événement « ${card.title} » : ${card.description}`);
  const effect = card.effect;
  if (effect.kind === 'move') {
    moveAndLand(state, playerId, effect.delta, depth, ctx);
  } else if (effect.kind === 'skip') {
    state.skipTurns[playerId] += effect.turns;
  } else if (effect.kind === 'reroll' || effect.kind === 'keepTurn') {
    ctx.turn.extra();
  } else if (effect.kind === 'goto') {
    setPosition(playerId, effect.target - 1, ctx);
    resolveLanding(state, playerId, effect.target - 1, depth, ctx);
  } else if (effect.kind === 'skipOthers') {
    for (const player of ctx.players.all()) {
      if (player.id !== playerId) state.skipTurns[player.id] += effect.turns;
    }
  } else if (effect.kind === 'choosePlayerMove') {
    requestEventMove(state, playerId, effect.deltas, ctx);
  }
}

function requestEventMove(
  state: MissionGalaxieState,
  actorId: number,
  deltas: number[],
  ctx: RuleContext,
): void {
  const options = deltas.flatMap((delta) =>
    ctx.players.all().map((player) => ({ targetId: player.id, delta })),
  );
  state.pendingChoice = { kind: 'event-move', actorId, options };
  ctx.choice.one({
    id: 'mission-galaxie.choice',
    player: actorId,
    options: options.map(encodeMove),
    label: (value) => {
      const option = options.find(
        (candidate) => encodeMove(candidate) === value,
      );
      const name = option ? ctx.players.get(option.targetId)?.username : null;
      return option
        ? `${name ?? option.targetId} ${option.delta >= 0 ? '+' : ''}${option.delta}`
        : value;
    },
  });
}

function moveAndLand(
  state: MissionGalaxieState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  const position = ctx.movement.move(TRACK, playerId, delta);
  resolveLanding(state, playerId, position, depth + 1, ctx);
}

function swapNearest(playerId: number, ctx: RuleContext): void {
  const current = ctx.movement.position(TRACK, playerId);
  const nearest = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => ({
      id: player.id,
      position: ctx.movement.position(TRACK, player.id),
    }))
    .sort(
      (a, b) =>
        Math.abs(a.position - current) - Math.abs(b.position - current) ||
        a.id - b.id,
    )[0];
  if (!nearest) return;
  setPosition(playerId, nearest.position, ctx);
  setPosition(nearest.id, current, ctx);
}

function setPosition(playerId: number, next: number, ctx: RuleContext): void {
  const current = ctx.movement.position(TRACK, playerId);
  ctx.movement.move(TRACK, playerId, next - current);
}

function completeTurn(state: MissionGalaxieState, ctx: RuleContext): void {
  if (state.pendingChoice == null && state.winnerId == null) ctx.turn.end();
}

function encodeMove(option: { targetId: number; delta: number }): string {
  return `${option.targetId}:${option.delta}`;
}
