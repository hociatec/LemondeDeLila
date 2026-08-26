import {
  rejectRule,
  defineGamePhases,
  rollDice,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { FOULEES_BOARD, FOULEES_FAMILIES } from './content';
import type { FouleesPendingMove, FouleesState } from './state';

type RuleContext = GameContext<FouleesState>;
export const FOULEES_PHASES = defineGamePhases<FouleesState>()({
  initialPhase: 'setup',
  phases: { setup: {}, turn: {} },
});
const PAWN_SET = 'foulees';

export const roll = rollDice<FouleesState>({
  documentation:
    'Lance le dé puis déplace un animal selon les règles de course.',
  available: ({ ctx }) => FOULEES_PHASES.is(ctx, 'turn'),
  execute: ({ state, playerId, total, ctx }) => {
    const moves = computeMoves(state, playerId, total, ctx);
    if (moves.length === 0) {
      if (total === 6) ctx.turn.extra();
      ctx.turn.complete();
      return;
    }
    if (moves.length === 1) {
      applyMove(state, playerId, moves[0], ctx);
      if (total === 6) ctx.turn.extra();
      ctx.turn.complete();
      return;
    }
    ctx.choice.one({
      id: 'foulees.move',
      player: playerId,
      options: moves.map(encodeMove),
      data: { actorId: playerId, roll: total },
      label: (encoded) => describeMove(playerId, encoded, ctx),
    });
  },
});

export const FOULEES_ACTIONS = { roll };

export function resolveFamilyChoice(
  _state: FouleesState,
  familyId: string,
  actorId: number,
  ctx: RuleContext,
): void {
  const family = FOULEES_FAMILIES.find(
    (candidate) => candidate.id === familyId,
  );
  if (!family) rejectRule('Famille Foulées invalide');
  if (
    ctx.players
      .all()
      .some((player) => selectedFamilyId(player.id, ctx) === familyId)
  ) {
    rejectRule('Cette famille est déjà choisie');
  }
  for (const pawnIndex of family.pawns.keys()) {
    ctx.pawns.assign(PAWN_SET, actorId, `${familyId}:${pawnIndex}`);
  }
  const next = ctx.players
    .all()
    .find((player) => ctx.pawns.assigned(PAWN_SET, player.id).length === 0);
  if (next) {
    ctx.turn.to(next.id);
    requestFamily(_state, next.id, ctx);
  } else {
    FOULEES_PHASES.transition(ctx, 'turn');
    const first = ctx.players.all()[0];
    if (first) ctx.turn.to(first.id);
  }
}

export function resolvePawnChoice(
  state: FouleesState,
  value: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeData<FouleesPendingMove>();
  if (!pending) rejectRule('Déplacement Foulées introuvable');
  const move = computeMoves(state, pending.actorId, pending.roll, ctx).find(
    (candidate) => encodeMove(candidate) === value,
  );
  if (!move) rejectRule('Déplacement Foulées invalide');
  applyMove(state, pending.actorId, move, ctx);
  if (pending.roll === 6) ctx.turn.extra();
  ctx.turn.complete();
}

export function requestFamily(
  _state: FouleesState,
  playerId: number,
  ctx: RuleContext,
): void {
  const taken = new Set(
    ctx.players
      .all()
      .map((player) => selectedFamilyId(player.id, ctx))
      .filter((familyId): familyId is string => familyId != null),
  );
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
  _state: FouleesState,
  playerId: number,
  roll: number,
  ctx: RuleContext,
): Array<{ pawnIndex: number; targetProgress: number }> {
  const offset = playerOffset(playerId, ctx);
  const arrival = FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength - 1;
  const opponents = opponentPositions(playerId, ctx);
  const playerPawns = pawnsFor(playerId, ctx);
  const occupiedBySelf = new Set(
    playerPawns
      .filter(
        (pawn) => pawn.progress >= 0 && pawn.progress < FOULEES_BOARD.trackLength,
      )
      .map((pawn) => (offset + pawn.progress) % FOULEES_BOARD.trackLength),
  );
  return ctx.pawns
    .legalMoves(PAWN_SET, playerId, roll, {
      target: ({ from }) => targetProgress(from, roll, arrival),
      canLand: ({ from, to }) => {
        if (from >= 0 && blockedOnPath(offset, from, to, roll, opponents)) {
          return false;
        }
        if (to < 0 || to >= FOULEES_BOARD.trackLength) return true;
        const destination = (offset + to) % FOULEES_BOARD.trackLength;
        if (occupiedBySelf.has(destination)) return false;
        return !(opponents.has(destination) && safeTiles(ctx).has(destination));
      },
    })
    .map((move) => ({
      pawnIndex: Number(move.pawnId.split(':')[1]),
      targetProgress: move.to,
    }));
}

function targetProgress(
  progress: number,
  roll: number,
  arrival: number,
): number | null {
  if (progress >= arrival) return null;
  if (progress < 0) return roll === 6 ? 0 : null;
  if (progress >= FOULEES_BOARD.trackLength) {
    const homeIndex = progress - FOULEES_BOARD.trackLength + 1;
    return homeIndex < FOULEES_BOARD.homeLength && roll === homeIndex + 1
      ? progress + 1
      : null;
  }
  const next = progress + roll;
  if (next > arrival || next > FOULEES_BOARD.trackLength) return null;
  return next;
}

function blockedOnPath(
  offset: number,
  from: number,
  target: number,
  roll: number,
  opponents: Set<number>,
): boolean {
  for (let step = 1; step <= roll; step += 1) {
    const progress = from + step;
    if (progress >= FOULEES_BOARD.trackLength) break;
    const position = (offset + progress) % FOULEES_BOARD.trackLength;
    if (opponents.has(position) && progress !== target) return true;
  }
  return false;
}

function applyMove(
  _state: FouleesState,
  playerId: number,
  move: { pawnIndex: number; targetProgress: number },
  ctx: RuleContext,
): void {
  const pawn = pawnsFor(playerId, ctx).find(
    (candidate) => candidate.pawnIndex === move.pawnIndex,
  );
  if (!pawn) rejectRule('Animal Foulées introuvable');
  ctx.pawns.applyMove(PAWN_SET, {
    pawnId: pawn.pawnId,
    from: pawn.progress,
    to: move.targetProgress,
    distance: move.targetProgress - pawn.progress,
  });
  capture(playerId, move.targetProgress, ctx);
  const arrival = FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength - 1;
  if (
    pawnsFor(playerId, ctx).every(
      (candidate) => candidate.progress >= arrival,
    )
  ) {
    ctx.match.finish({ winners: [playerId], reason: 'four-pawns-home' });
  }
}

function capture(
  playerId: number,
  progress: number,
  ctx: RuleContext,
): void {
  if (progress < 0 || progress >= FOULEES_BOARD.trackLength) return;
  const destination =
    (playerOffset(playerId, ctx) + progress) % FOULEES_BOARD.trackLength;
  if (safeTiles(ctx).has(destination)) return;
  for (const player of ctx.players.all()) {
    if (player.id === playerId) continue;
    const offset = playerOffset(player.id, ctx);
    for (const pawn of pawnsFor(player.id, ctx)) {
      if (
        pawn.progress >= 0 &&
        pawn.progress < FOULEES_BOARD.trackLength &&
        (offset + pawn.progress) % FOULEES_BOARD.trackLength === destination
      ) {
        ctx.pawns.moveTo(PAWN_SET, pawn.pawnId, -1);
      }
    }
  }
}

function opponentPositions(
  playerId: number,
  ctx: RuleContext,
): Set<number> {
  const occupied = new Set<number>();
  for (const player of ctx.players.all()) {
    if (player.id === playerId) continue;
    for (const pawn of pawnsFor(player.id, ctx)) {
      if (
        pawn.progress >= 0 &&
        pawn.progress < FOULEES_BOARD.trackLength
      ) {
        occupied.add(
          (playerOffset(player.id, ctx) + pawn.progress) % FOULEES_BOARD.trackLength,
        );
      }
    }
  }
  return occupied;
}

function safeTiles(ctx: RuleContext): Set<number> {
  return new Set([
    ...FOULEES_BOARD.safeTiles,
    ...ctx.players.all().map((player) => playerOffset(player.id, ctx)),
  ]);
}

function encodeMove(move: {
  pawnIndex: number;
  targetProgress: number;
}): string {
  return `${move.pawnIndex}:${move.targetProgress}`;
}

function describeMove(
  playerId: number,
  value: string,
  ctx: RuleContext,
): string {
  const [pawnIndex, progress] = value.split(':').map(Number);
  const family = FOULEES_FAMILIES.find(
    (entry) => entry.id === selectedFamilyId(playerId, ctx),
  );
  return `${family?.pawns[pawnIndex] ?? `Animal ${pawnIndex + 1}`} vers ${progress}`;
}

function pawnsFor(
  playerId: number,
  ctx: RuleContext,
): Array<FouleesPawn & { pawnId: string }> {
  return ctx.pawns.assigned(PAWN_SET, playerId).map((pawnId) => ({
    pawnId,
    pawnIndex: Number(pawnId.split(':')[1]),
    progress: ctx.pawns.position(PAWN_SET, pawnId),
  }));
}

function selectedFamilyId(playerId: number, ctx: RuleContext): string | null {
  return ctx.pawns.assigned(PAWN_SET, playerId)[0]?.split(':')[0] ?? null;
}

function playerOffset(playerId: number, ctx: RuleContext): number {
  const index = ctx.players.all().findIndex((player) => player.id === playerId);
  return [
    0,
    Math.floor(FOULEES_BOARD.trackLength / 2),
    Math.floor(FOULEES_BOARD.trackLength / 4),
    Math.floor((FOULEES_BOARD.trackLength * 3) / 4),
  ][Math.max(0, index)];
}
