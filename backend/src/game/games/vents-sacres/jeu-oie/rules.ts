import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { GOOSE_PAWNS, GOOSE_TILES } from './content';
import type { JeuOieState } from './state';

const TRACK = 'goose-board';
const FINISH = 63;
type RuleContext = GameRuleContext<JeuOieState>;

export const roll = defineAction<JeuOieState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout toutes les cases spéciales.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    if (state.inWell[actor.id]) {
      if (value !== 1) {
        ctx.history.add(`${actor.username} reste bloqué dans le puits.`);
        ctx.turn.end();
        return;
      }
      state.inWell[actor.id] = false;
    }
    const position = bounce(ctx.movement.position(TRACK, actor.id) + value);
    land(state, actor.id, position, value, 0, ctx);
    if (state.winnerId == null) ctx.turn.end();
  },
});

export const JEU_OIE_ACTIONS = { roll };

export function initializeGoose(state: JeuOieState, ctx: RuleContext): void {
  for (const player of ctx.players.all())
    ctx.movement.move(TRACK, player.id, 1);
  queuePawnChoice(state, ctx);
}

export function assignPawn(
  state: JeuOieState,
  pawnId: string,
  ctx: RuleContext,
): void {
  const playerId = state.selectionOrder[state.selectionIndex];
  if (playerId == null) throw new Error('Joueur de sélection introuvable');
  state.pawnByPlayerId[playerId] = pawnId;
  state.selectionIndex += 1;
  if (state.selectionIndex >= state.selectionOrder.length) {
    state.setupComplete = true;
    ctx.turn.to(state.selectionOrder[0]);
    ctx.history.add(
      `Début de partie : ${ctx.players.get(state.selectionOrder[0])?.username ?? 'le premier joueur'} commence.`,
    );
    return;
  }
  queuePawnChoice(state, ctx);
}

export function skipGoosePlayer(state: JeuOieState, ctx: RuleContext): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} saute son tour.`);
  ctx.turn.end();
}

function queuePawnChoice(state: JeuOieState, ctx: RuleContext): void {
  const playerId = state.selectionOrder[state.selectionIndex];
  if (playerId == null) return;
  const used = new Set(Object.values(state.pawnByPlayerId));
  const options = GOOSE_PAWNS.filter((pawn) => !used.has(pawn.id)).map(
    (pawn) => pawn.id,
  );
  ctx.choice.one({
    id: 'goose.pawn',
    player: playerId,
    options,
    label: (pawnId) =>
      GOOSE_PAWNS.find((pawn) => pawn.id === pawnId)?.label ?? pawnId,
  });
}

function land(
  state: JeuOieState,
  playerId: number,
  position: number,
  rollValue: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > 20)
    throw new Error('Chaîne de cases du Jeu de l’Oie trop longue');
  setPosition(playerId, position, ctx);
  const tile = GOOSE_TILES[position];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} atteint la case ${position} (${tile.label}).`,
  );
  if (tile.description) ctx.history.add(tile.description);
  if (tile.type === 'finish') state.winnerId = playerId;
  else if (tile.type === 'bridge')
    land(state, playerId, 12, rollValue, depth + 1, ctx);
  else if (tile.type === 'death' || tile.type === 'labyrinth') {
    land(state, playerId, tile.backTo ?? 1, rollValue, depth + 1, ctx);
  } else if (tile.type === 'inn' || tile.type === 'prison') {
    state.skipTurns[playerId] += tile.skipTurns ?? 1;
  } else if (tile.type === 'magic-die') {
    const magic = ctx.dice.roll('main').total;
    state.lastRoll = magic;
    const delta = magic <= 3 ? magic : -magic;
    land(state, playerId, bounce(position + delta), magic, depth + 1, ctx);
  } else if (tile.type === 'well') state.inWell[playerId] = true;
  else if (tile.type === 'goose') {
    land(
      state,
      playerId,
      bounce(position + rollValue),
      rollValue,
      depth + 1,
      ctx,
    );
  }
}

function bounce(position: number): number {
  if (position < 0) return 0;
  return position <= FINISH
    ? position
    : Math.max(0, FINISH - (position - FINISH));
}

function setPosition(
  playerId: number,
  position: number,
  ctx: RuleContext,
): void {
  const current = ctx.movement.position(TRACK, playerId);
  ctx.movement.move(TRACK, playerId, position - current);
}
