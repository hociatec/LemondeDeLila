import {
  rejectRule,
  defineAction,
  gameInput,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { GOOSE_TILES } from './content';
import type { JeuOieState } from './state';

const TRACK = 'goose-board';
const FINISH = 63;
export const GOOSE_IN_WELL = 'goose.in-well';
type RuleContext = GameContext<JeuOieState>;
export const JEU_OIE_PHASES = setupPlayingPhases<JeuOieState>();

export const roll = defineAction<JeuOieState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout toutes les cases spéciales.',
  available: ({ ctx }) => JEU_OIE_PHASES.is(ctx, 'playing'),
  execute: ({ actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    ctx.events.message('game.dice.rolled', {
      playerId: actor.id,
      diceId: 'main',
      value,
    });
    if (ctx.status.has(actor.id, GOOSE_IN_WELL)) {
      if (value !== 1) {
        ctx.events.message('goose.well.blocked', { playerId: actor.id });
        ctx.turn.end();
        return;
      }
      ctx.status.remove(actor.id, GOOSE_IN_WELL);
    }
    const position = ctx.movement.preview(TRACK, actor.id, value);
    land(actor.id, position, value, 0, ctx);
    if (ctx.match.lifecycle() !== 'finished') ctx.turn.end();
  },
});

export const JEU_OIE_ACTIONS = { roll };

export function initializeGoose(
  selectionOrder: number[],
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all())
    ctx.movement.move(TRACK, player.id, 1);
  queuePawnChoice(selectionOrder, 0, ctx);
}

export function assignPawn(
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeData<{
    selectionOrder: number[];
    selectionIndex: number;
  }>();
  if (!pending) rejectRule('Ordre de sélection introuvable');
  const playerId = pending.selectionOrder[pending.selectionIndex];
  if (playerId == null || playerId !== actorId) {
    rejectRule('Joueur de sélection introuvable');
  }
  ctx.pawns.assign('goose', actorId, pawnId);
  const selectionIndex = pending.selectionIndex + 1;
  if (selectionIndex >= pending.selectionOrder.length) {
    JEU_OIE_PHASES.transition(ctx, 'playing');
    ctx.turn.to(pending.selectionOrder[0]);
    ctx.events.message('game.started', {
      startingPlayerId: pending.selectionOrder[0],
    });
    return;
  }
  queuePawnChoice(pending.selectionOrder, selectionIndex, ctx);
}

function queuePawnChoice(
  selectionOrder: number[],
  selectionIndex: number,
  ctx: RuleContext,
): void {
  const playerId = selectionOrder[selectionIndex];
  if (playerId == null) return;
  const available = ctx.pawns.available('goose');
  const options = available.map((pawn) => pawn.id);
  ctx.choice.pawn({
    id: 'goose.pawn',
    player: playerId,
    options,
    data: { selectionOrder, selectionIndex },
    label: (pawnId) =>
      available.find((pawn) => pawn.id === pawnId)?.label ?? pawnId,
  });
}

function land(
  playerId: number,
  position: number,
  rollValue: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > 20) rejectRule('Chaîne de cases du Jeu de l’Oie trop longue');
  position = ctx.movement.moveTo(TRACK, playerId, position);
  const tile = GOOSE_TILES[position];
  ctx.events.message('game.pawn.landed', {
    playerId,
    tileId: tile.id,
    position,
  });
  if (tile.description) {
    ctx.events.message('goose.tile.effect', {
      playerId,
      tileId: tile.id,
      tileType: tile.type,
    });
  }
  if (tile.type === 'finish') {
    ctx.match.finish({ winners: [playerId], reason: 'case-63' });
  }
  else if (tile.type === 'bridge')
    land(playerId, 12, rollValue, depth + 1, ctx);
  else if (tile.type === 'death' || tile.type === 'labyrinth') {
    land(playerId, tile.backTo ?? 1, rollValue, depth + 1, ctx);
  } else if (tile.type === 'inn' || tile.type === 'prison') {
    ctx.turn.skip(playerId, tile.skipTurns ?? 1);
  } else if (tile.type === 'magic-die') {
    const magic = ctx.dice.roll('main').total;
    const delta = magic <= 3 ? magic : -magic;
    land(
      playerId,
      ctx.movement.preview(TRACK, playerId, delta),
      magic,
      depth + 1,
      ctx,
    );
  } else if (tile.type === 'well') {
    ctx.status.add(playerId, GOOSE_IN_WELL, { scope: 'match' });
  }
  else if (tile.type === 'goose') {
    land(
      playerId,
      ctx.movement.preview(TRACK, playerId, rollValue),
      rollValue,
      depth + 1,
      ctx,
    );
  }
}
