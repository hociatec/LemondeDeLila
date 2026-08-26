import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { FOULEES_FAMILIES } from './content';
import type { FouleesPawn, FouleesState } from './state';

type RuleContext = GameRuleContext<FouleesState>;

export const roll = defineAction<FouleesState, Record<string, never>>({
  input: gameInput.object({}),
  documentation:
    'Lance le dé puis déplace un animal selon les règles de course.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    const moves = computeMoves(state, actor.id, value, ctx);
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    if (moves.length === 0) {
      endTurn(value, ctx);
      return;
    }
    if (moves.length === 1) {
      applyMove(state, actor.id, moves[0], ctx);
      if (state.winnerId == null) endTurn(value, ctx);
      return;
    }
    state.pendingMove = { actorId: actor.id, roll: value, moves };
    ctx.choice.one({
      id: 'foulees.move',
      player: actor.id,
      options: moves.map(encodeMove),
      label: (encoded) => describeMove(state, actor.id, encoded),
    });
  },
});

export const FOULEES_ACTIONS = { roll };

export function resolveFamilyChoice(
  state: FouleesState,
  familyId: string,
  actorId: number,
  ctx: RuleContext,
): void {
  const family = FOULEES_FAMILIES.find(
    (candidate) => candidate.id === familyId,
  );
  if (!family) throw new Error('Famille Foulées invalide');
  if (Object.values(state.familyIdByPlayer).includes(familyId)) {
    throw new Error('Cette famille est déjà choisie');
  }
  state.familyIdByPlayer[actorId] = familyId;
  const next = ctx.players
    .all()
    .find((player) => state.familyIdByPlayer[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestFamily(state, next.id, ctx);
  } else {
    state.setupComplete = true;
    ctx.transitionTo('turn');
    const first = ctx.players.all()[0];
    if (first) ctx.turn.to(first.id);
  }
}

export function resolvePawnChoice(
  state: FouleesState,
  value: string,
  ctx: RuleContext,
): void {
  const pending = state.pendingMove;
  if (!pending) throw new Error('Déplacement Foulées introuvable');
  const move = pending.moves.find(
    (candidate) => encodeMove(candidate) === value,
  );
  if (!move) throw new Error('Déplacement Foulées invalide');
  state.pendingMove = null;
  applyMove(state, pending.actorId, move, ctx);
  if (state.winnerId == null) endTurn(pending.roll, ctx);
}

export function requestFamily(
  state: FouleesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const taken = new Set(Object.values(state.familyIdByPlayer));
  const options = FOULEES_FAMILIES.filter((family) => !taken.has(family.id));
  ctx.choice.one({
    id: 'foulees.family',
    player: playerId,
    options: options.map((family) => family.id),
    label: (familyId) => {
      const family = FOULEES_FAMILIES.find((entry) => entry.id === familyId);
      return family ? `${family.family} (${family.habitat})` : familyId;
    },
  });
}

function computeMoves(
  state: FouleesState,
  playerId: number,
  roll: number,
  ctx: RuleContext,
): Array<{ pawnIndex: number; targetProgress: number }> {
  const offset = state.offsets[playerId];
  const arrival = state.trackLength + state.homeLength - 1;
  const opponents = opponentPositions(state, playerId, ctx);
  const occupiedBySelf = new Set(
    state.pawnsByPlayer[playerId]
      .filter((pawn) => pawn.progress >= 0 && pawn.progress < state.trackLength)
      .map((pawn) => (offset + pawn.progress) % state.trackLength),
  );
  return state.pawnsByPlayer[playerId].flatMap((pawn) => {
    const target = targetProgress(state, pawn, roll, arrival);
    if (target == null) return [];
    if (
      pawn.progress >= 0 &&
      blockedOnPath(state, offset, pawn.progress, target, roll, opponents)
    ) {
      return [];
    }
    if (target >= 0 && target < state.trackLength) {
      const destination = (offset + target) % state.trackLength;
      if (occupiedBySelf.has(destination)) return [];
      if (opponents.has(destination) && state.safeTiles.includes(destination)) {
        return [];
      }
    }
    return [{ pawnIndex: pawn.pawnIndex, targetProgress: target }];
  });
}

function targetProgress(
  state: FouleesState,
  pawn: FouleesPawn,
  roll: number,
  arrival: number,
): number | null {
  if (pawn.progress >= arrival) return null;
  if (pawn.progress < 0) return roll === 6 ? 0 : null;
  if (pawn.progress >= state.trackLength) {
    const homeIndex = pawn.progress - state.trackLength + 1;
    return homeIndex < state.homeLength && roll === homeIndex + 1
      ? pawn.progress + 1
      : null;
  }
  const next = pawn.progress + roll;
  if (next > arrival || next > state.trackLength) return null;
  return next;
}

function blockedOnPath(
  state: FouleesState,
  offset: number,
  from: number,
  target: number,
  roll: number,
  opponents: Set<number>,
): boolean {
  for (let step = 1; step <= roll; step += 1) {
    const progress = from + step;
    if (progress >= state.trackLength) break;
    const position = (offset + progress) % state.trackLength;
    if (opponents.has(position) && progress !== target) return true;
  }
  return false;
}

function applyMove(
  state: FouleesState,
  playerId: number,
  move: { pawnIndex: number; targetProgress: number },
  ctx: RuleContext,
): void {
  const pawn = state.pawnsByPlayer[playerId].find(
    (candidate) => candidate.pawnIndex === move.pawnIndex,
  );
  if (!pawn) throw new Error('Animal Foulées introuvable');
  pawn.progress = move.targetProgress;
  capture(state, playerId, move.targetProgress, ctx);
  const arrival = state.trackLength + state.homeLength - 1;
  if (
    state.pawnsByPlayer[playerId].every(
      (candidate) => candidate.progress >= arrival,
    )
  ) {
    state.winnerId = playerId;
  }
}

function capture(
  state: FouleesState,
  playerId: number,
  progress: number,
  ctx: RuleContext,
): void {
  if (progress < 0 || progress >= state.trackLength) return;
  const destination = (state.offsets[playerId] + progress) % state.trackLength;
  if (state.safeTiles.includes(destination)) return;
  for (const player of ctx.players.all()) {
    if (player.id === playerId) continue;
    const offset = state.offsets[player.id];
    for (const pawn of state.pawnsByPlayer[player.id]) {
      if (
        pawn.progress >= 0 &&
        pawn.progress < state.trackLength &&
        (offset + pawn.progress) % state.trackLength === destination
      ) {
        pawn.progress = -1;
      }
    }
  }
}

function opponentPositions(
  state: FouleesState,
  playerId: number,
  ctx: RuleContext,
): Set<number> {
  const occupied = new Set<number>();
  for (const player of ctx.players.all()) {
    if (player.id === playerId) continue;
    for (const pawn of state.pawnsByPlayer[player.id]) {
      if (pawn.progress >= 0 && pawn.progress < state.trackLength) {
        occupied.add(
          (state.offsets[player.id] + pawn.progress) % state.trackLength,
        );
      }
    }
  }
  return occupied;
}

function endTurn(roll: number, ctx: RuleContext): void {
  if (roll === 6) ctx.turn.extra();
  ctx.turn.end();
}

function encodeMove(move: {
  pawnIndex: number;
  targetProgress: number;
}): string {
  return `${move.pawnIndex}:${move.targetProgress}`;
}

function describeMove(
  state: FouleesState,
  playerId: number,
  value: string,
): string {
  const [pawnIndex, progress] = value.split(':').map(Number);
  const family = FOULEES_FAMILIES.find(
    (entry) => entry.id === state.familyIdByPlayer[playerId],
  );
  return `${family?.pawns[pawnIndex] ?? `Animal ${pawnIndex + 1}`} vers ${progress}`;
}
