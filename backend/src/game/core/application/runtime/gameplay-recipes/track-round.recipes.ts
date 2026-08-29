import type { GameActionDefinition } from '../game-definition';
import type { DiceRollPolicy } from '../dice-kit';
import type { GameContext } from '../game-rule-context';
import type { GameEffectInstruction } from '../effects-kit';
import { drawEvent, rollDice } from './card-dice.recipes';

export type CompleteRoundOptions<TState extends object> = {
  winnerPlayerIds?: readonly number[];
  end?: boolean;
  score?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  finishMatch?: (input: {
    state: TState;
    ctx: GameContext<TState>;
  }) => boolean | void;
  reset?: (input: { state: TState; ctx: GameContext<TState> }) => void;
  next?:
    | false
    | 'rotate'
    | { starterPlayerId: number }
    | ((input: { state: TState; ctx: GameContext<TState> }) => number | null);
};

export type TileDefinition<TTileType extends string = string> = {
  id: string | number;
  type?: TTileType;
  tags?: readonly string[];
  eventDeckId?: string;
  movement?: number;
  status?: string;
  effects?: readonly GameEffectInstruction[];
  quizId?: string;
};

export type TileResolutionInput<TState extends object, TTile> = {
  state: TState;
  trackId: string;
  playerId: number;
  tile: TTile;
  position: number;
  ctx: GameContext<TState>;
};

export type TileResolutionRule<TState extends object, TTile> = {
  type?: string;
  tag?: string;
  when?: (input: TileResolutionInput<TState, TTile>) => boolean;
  apply: (input: TileResolutionInput<TState, TTile>) => void;
};

export type EventTrackOptions<TState extends object, TTile> = {
  trackId: string;
  tiles: readonly TTile[];
  diceId?: string;
  policy?: DiceRollPolicy;
  endTurn?: boolean;
  maxLandingDepth?: number;
  rules?: readonly TileResolutionRule<TState, TTile>[];
  resolve?: (input: TileResolutionInput<TState, TTile>) => void;
};

export function positionOf<TState extends object>(
  ctx: GameContext<TState>,
  trackId: string,
  playerId: number,
): number {
  return ctx.movement.position(trackId, playerId);
}

export function resolveTile<TState extends object, TTile>(
  input: TileResolutionInput<TState, TTile> & {
    rules?: readonly TileResolutionRule<TState, TTile>[];
  },
): void {
  const tileRecord = input.tile as {
    type?: string;
    tags?: readonly string[];
    eventDeckId?: string;
    movement?: number;
    status?: string;
    effects?: readonly GameEffectInstruction[];
    quizId?: string;
  };
  for (const rule of input.rules ?? []) {
    if (rule.type && tileRecord.type !== rule.type) continue;
    if (rule.tag && !(tileRecord.tags ?? []).includes(rule.tag)) continue;
    if (rule.when && !rule.when(input)) continue;
    rule.apply(input);
  }
  if (tileRecord.eventDeckId) {
    drawEvent<TState, unknown>(input.ctx, {
      deckId: tileRecord.eventDeckId,
      playerId: input.playerId,
      recycle: true,
      discard: true,
    });
  }
  if (tileRecord.movement) {
    input.ctx.movement.move(input.trackId, input.playerId, tileRecord.movement);
  }
  if (tileRecord.status)
    input.ctx.status.add(input.playerId, tileRecord.status);
  if (tileRecord.effects?.length)
    input.ctx.effects.schedule(...tileRecord.effects);
}

export function eventTrackTurn<TState extends object, TTile>(
  options: EventTrackOptions<TState, TTile>,
): GameActionDefinition<TState, Record<string, never>> {
  return rollDice<TState>({
    diceId: options.diceId,
    policy: options.policy,
    execute: ({ state, playerId, total, ctx }) => {
      ctx.movement.moveAndResolve({
        trackId: options.trackId,
        playerId,
        distance: total,
        tiles: options.tiles,
        maxDepth: options.maxLandingDepth ?? 8,
        blocked: () => ctx.choice.current() != null,
        onLand: ({ position, tile }) => {
          if (tile == null) return;
          const input = {
            state,
            trackId: options.trackId,
            playerId,
            tile,
            position,
            ctx,
          };
          resolveTile({ ...input, rules: options.rules });
          options.resolve?.(input);
        },
      });
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation:
      'Lance le dé, avance sur une piste, résout la case atteinte et termine le tour si aucun workflow ne suspend la résolution.',
  });
}

/**
 * Pipeline unique de fin de manche: score, résultat de manche, résultat de
 * partie, reset puis sélection/démarrage du prochain starter.
 */
export function completeRound<TState extends object>(
  ctx: GameContext<TState>,
  options: CompleteRoundOptions<TState>,
): boolean {
  const input = { state: ctx.state, ctx };
  options.score?.(input);
  if (options.end !== false) {
    ctx.round.end([...(options.winnerPlayerIds ?? [])]);
  }
  const explicitlyFinished = options.finishMatch?.(input) === true;
  if (explicitlyFinished || ctx.match.lifecycle() === 'finished') return false;
  options.reset?.(input);
  if (options.next === false) return false;
  if (typeof options.next === 'function') {
    const starterPlayerId = options.next(input);
    if (starterPlayerId != null) ctx.round.start(starterPlayerId);
  } else if (options.next && options.next !== 'rotate') {
    ctx.round.start(options.next.starterPlayerId);
  } else {
    ctx.round.next();
  }
  return true;
}
