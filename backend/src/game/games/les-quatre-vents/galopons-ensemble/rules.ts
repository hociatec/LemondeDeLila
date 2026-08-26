import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  GALOPONS_PAWNS,
  GALOPONS_TILES,
  type GaloponsCard,
  type GaloponsCardEffect,
  type GaloponsRegion,
} from './content';
import type { GaloponsState, GaloponsTargetKind } from './state';

type RuleContext = GameRuleContext<GaloponsState>;
const TRACK = 'galopons';
const DECK = 'adventure';
const FINISH = GALOPONS_TILES.length - 1;
const APPLES_TO_WIN = 3;
const MAX_DEPTH = 12;

export const roll = defineAction<GaloponsState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Paie les dettes, lance le dé et résout la case équestre.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    payIou(state, actor.id);
    const value = ctx.dice.roll('main').total;
    ctx.history.add(`${actor.username} lance le dé : ${value}.`);
    moveAndLand(state, actor.id, value, 0, ctx);
    completeTurn(state, actor.id, ctx);
  },
});

export const GALOPONS_ACTIONS = { roll };

export function resolvePawn(
  state: GaloponsState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!GALOPONS_PAWNS.some((pawn) => pawn.id === pawnId)) {
    throw new Error('Pion Galopons invalide');
  }
  if (Object.values(state.pawnByPlayerId).includes(pawnId)) {
    throw new Error('Pion déjà attribué');
  }
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
  } else {
    state.setupComplete = true;
    ctx.transitionTo('playing');
    ctx.turn.to(state.starterId);
  }
}

export function requestPawn(
  state: GaloponsState,
  playerId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const available = GALOPONS_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'galopons.pawn',
    player: playerId,
    options: available.map((pawn) => pawn.id),
    label: (id) => available.find((pawn) => pawn.id === id)?.name ?? id,
  });
}

export function resolveTarget(
  state: GaloponsState,
  kind: GaloponsTargetKind,
  targetId: number,
  ctx: RuleContext,
): void {
  if (state.targetKind !== kind || state.targetActorId == null) {
    throw new Error('Choix Galopons inattendu');
  }
  const actorId = state.targetActorId;
  if (targetId === actorId || !ctx.players.get(targetId)) {
    throw new Error('Cible Galopons invalide');
  }
  state.targetKind = null;
  state.targetActorId = null;
  if (kind === 'give-apple') giveAppleWithIou(state, actorId, targetId);
  else if (kind === 'help-advance') {
    moveAndLand(state, targetId, 2, 0, ctx);
    if (state.apples[targetId] > 0) {
      state.apples[targetId] -= 1;
      state.apples[actorId] += 1;
    }
  } else {
    moveAndLand(state, actorId, 1, 0, ctx);
    if (state.targetKind == null) moveAndLand(state, targetId, 1, 0, ctx);
  }
  completeTurn(state, actorId, ctx);
}

export function skipGaloponsPlayer(
  state: GaloponsState,
  ctx: RuleContext,
): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

function moveAndLand(
  state: GaloponsState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.winnerId != null) return;
  moveHorse(state, playerId, delta, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function moveHorse(
  state: GaloponsState,
  playerId: number,
  delta: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const direction = state.movementDirection[playerId];
  const signed = delta < 0 ? -direction : direction;
  let target = current;
  let nextDirection = direction;
  for (let step = 0; step < Math.abs(Math.trunc(delta)); step += 1) {
    target += signed;
    if (target > FINISH) {
      target = FINISH - (target - FINISH);
      nextDirection = -1;
    } else if (target < 0) {
      target = -target;
      nextDirection = 1;
    }
  }
  if (direction === -1 && target === 0) nextDirection = 1;
  moveTo(playerId, target, ctx);
  state.movementDirection[playerId] = nextDirection;
}

function resolveLanding(
  state: GaloponsState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const tile = GALOPONS_TILES[current];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint ${tile.title}.`,
  );
  if (tile.type === 'finish') {
    state.apples[playerId] += 1;
    if (state.apples[playerId] >= APPLES_TO_WIN) state.winnerId = playerId;
    else state.movementDirection[playerId] = -1;
    return;
  }
  const occupant = ctx.players
    .all()
    .find(
      (player) =>
        player.id !== playerId && position(player.id, ctx) === current,
    );
  if (occupant) moveHorse(state, occupant.id, -5, ctx);
  if (tile.type === 'bonus') state.apples[playerId] += tile.apples;
  else if (tile.type === 'skip') state.skipTurns[playerId] += tile.skipTurns;
  else if (tile.type === 'card') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: GaloponsState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.targetKind != null) return;
  const card = ctx.cards.drawOrRecycle<GaloponsCard>(DECK);
  if (!card) return;
  ctx.cards.discard(DECK, card);
  ctx.history.add(card.text);
  applyEffect(state, playerId, card.effect, depth + 1, ctx);
}

function applyEffect(
  state: GaloponsState,
  playerId: number,
  effect: GaloponsCardEffect,
  depth: number,
  ctx: RuleContext,
): void {
  if (effect.kind === 'move') {
    moveAndLand(state, playerId, effect.delta, depth, ctx);
  } else if (effect.kind === 'move_to_next_region') {
    moveToNextRegion(state, playerId, effect.region, depth, ctx);
  } else if (effect.kind === 'replay') state.replay = true;
  else if (effect.kind === 'gain_apples')
    state.apples[playerId] += effect.count;
  else if (effect.kind === 'skip_turn')
    state.skipTurns[playerId] += effect.count;
  else if (effect.kind === 'global_skip_turn') {
    for (const player of ctx.players.all())
      state.skipTurns[player.id] += effect.count;
  } else if (effect.kind === 'discard_apple_and_replay') {
    state.apples[playerId] = Math.max(0, state.apples[playerId] - 1);
    state.replay = true;
  } else if (effect.kind === 'discard_apple') {
    state.apples[playerId] = Math.max(0, state.apples[playerId] - 1);
  } else if (effect.kind === 'give_apple_with_iou') {
    requestTarget(state, playerId, 'give-apple', ctx);
  } else if (effect.kind === 'help_advance_for_apple') {
    requestTarget(state, playerId, 'help-advance', ctx);
  } else if (effect.kind === 'pair_advance') {
    requestTarget(state, playerId, 'pair-advance', ctx);
  }
}

function moveToNextRegion(
  state: GaloponsState,
  playerId: number,
  region: GaloponsRegion,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const direction = state.movementDirection[playerId];
  const target = GALOPONS_TILES.findIndex(
    (tile, index) =>
      tile.region === region &&
      (direction === 1 ? index > current : index < current),
  );
  if (target >= 0) {
    moveTo(playerId, target, ctx);
    resolveLanding(state, playerId, depth + 1, ctx);
  }
}

function requestTarget(
  state: GaloponsState,
  actorId: number,
  kind: GaloponsTargetKind,
  ctx: RuleContext,
): void {
  state.targetKind = kind;
  state.targetActorId = actorId;
  const players = ctx.players.all().filter((player) => player.id !== actorId);
  ctx.choice.one({
    id: `galopons.${kind}`,
    player: actorId,
    options: players.map((player) => player.id),
    label: (id) => ctx.players.get(id)?.username ?? `Joueur ${id}`,
  });
}

function giveAppleWithIou(
  state: GaloponsState,
  actorId: number,
  targetId: number,
): void {
  if (state.apples[actorId] <= 0) return;
  state.apples[actorId] -= 1;
  state.apples[targetId] += 1;
  const debts = (state.ious[targetId] ??= {});
  debts[actorId] = (debts[actorId] ?? 0) + 1;
}

function payIou(state: GaloponsState, playerId: number): void {
  const debts = state.ious[playerId] ?? {};
  const creditor = Object.keys(debts)
    .map(Number)
    .find((id) => debts[id] > 0);
  if (creditor == null || state.apples[playerId] <= 0) return;
  state.apples[playerId] -= 1;
  state.apples[creditor] += 1;
  debts[creditor] -= 1;
}

function completeTurn(
  state: GaloponsState,
  actorId: number,
  ctx: RuleContext,
): void {
  if (state.winnerId != null || state.targetKind != null) return;
  if (state.replay) {
    state.replay = false;
    ctx.turn.to(actorId);
  } else ctx.turn.end();
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function moveTo(playerId: number, target: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}
