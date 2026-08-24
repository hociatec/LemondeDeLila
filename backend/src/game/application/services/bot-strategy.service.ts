import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../models/game-action.model';
import { GameStateEntity } from '../models/game-state.model';
import { RandomService } from './random.service';

export type BotDecisionOptions = {
  preferTypes?: string[];
  fallbackTypes?: string[];
  score?: (
    action: GameSingleActionDto,
    ctx: { state: GameStateEntity; playerId: number },
  ) => number;
};

export type BotProfile = 'random' | 'greedy' | 'cautious' | 'aggressive';

@Injectable()
export class BotStrategyService {
  constructor(private readonly random: RandomService) {}

  choose(
    actions: GameSingleActionDto[],
    ctx: { state: GameStateEntity; playerId: number },
    opts: BotDecisionOptions = {},
  ): GameSingleActionDto[] {
    if (!Array.isArray(actions) || actions.length === 0) return [];

    const { score } = opts;
    const prefer = (opts.preferTypes ?? []).map((t) => t.toLowerCase());
    const fallbacks = (opts.fallbackTypes ?? []).map((t) => t.toLowerCase());

    if (score) {
      let bestScore = -Infinity;
      const best: GameSingleActionDto[] = [];

      for (const action of actions) {
        const s = score(action, ctx);
        if (s > bestScore + Number.EPSILON) {
          bestScore = s;
          best.length = 0;
          best.push(action);
          continue;
        }
        if (Math.abs(s - bestScore) <= Number.EPSILON) {
          best.push(action);
        }
      }

      if (best.length === 0) return [];
      if (best.length === 1) return [best[0]];
      const pick = this.pickAction(best, ctx.state);
      return pick ? [pick] : [];
    }

    for (const type of prefer) {
      const found = actions.find((a) => a.type?.toLowerCase() === type);
      if (found) return [found];
    }
    for (const type of fallbacks) {
      const found = actions.find((a) => a.type?.toLowerCase() === type);
      if (found) return [found];
    }

    const pick = this.pickAction(actions, ctx.state);
    return pick ? [pick] : [];
  }

  chooseProfile(
    actions: GameSingleActionDto[],
    ctx: { state: GameStateEntity; playerId: number },
    profile: BotProfile = 'random',
    opts: BotDecisionOptions = {},
  ): GameSingleActionDto[] {
    const scoreFn =
      opts.score ??
      ((action: GameSingleActionDto) => {
        if (profile === 'random') return this.randomScore(ctx.state);

        const weights: Record<BotProfile, Record<string, number>> = {
          greedy: {
            ask_card: 6,
            draw: 4,
            exchange_with: 5,
            exchange: 4,
            answer_quiz: 5,
            roll: 1,
          },
          cautious: {
            draw: 5,
            answer_quiz: 4,
            ask_card: 3,
            exchange_with: 2,
            exchange: 2,
            roll: 1,
          },
          aggressive: {
            ask_card: 7,
            exchange_with: 6,
            exchange: 5,
            draw: 3,
            answer_quiz: 4,
            roll: 1,
          },
          random: {},
        };

        const type = (action.type ?? '').toLowerCase();
        const table = weights[profile] ?? {};
        const base = table[type] ?? 0;

        const quizBonus =
          type.includes('quiz') &&
          (action.payload?.correct === true || action.payload?.answer)
            ? 1
            : 0;

        return base + quizBonus;
      });

    return this.choose(actions, ctx, { ...opts, score: scoreFn });
  }

  private pickAction(
    actions: readonly GameSingleActionDto[],
    state: GameStateEntity,
  ): GameSingleActionDto | null {
    return this.random.pickOne(this.asMetaRecord(state.metadata), actions).value;
  }

  private randomScore(state: GameStateEntity): number {
    return this.random.nextFloat(this.asMetaRecord(state.metadata)).value;
  }

  private asMetaRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}

