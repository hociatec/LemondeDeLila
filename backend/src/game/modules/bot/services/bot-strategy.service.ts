import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';

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
  /**
   * Sélectionne une action en fonction de préférences simples.
   * - Priorise les types listés dans preferTypes (ordre)
   * - Sinon tente fallbackTypes
   * - Sinon choisit aléatoirement parmi les actions disponibles
   */
  choose(
    actions: GameSingleActionDto[],
    ctx: { state: GameStateEntity; playerId: number },
    opts: BotDecisionOptions = {},
  ): GameSingleActionDto[] {
    if (!Array.isArray(actions) || actions.length === 0) return [];

    const { score } = opts;
    const prefer = (opts.preferTypes ?? []).map((t) => t.toLowerCase());
    const fallbacks = (opts.fallbackTypes ?? []).map((t) => t.toLowerCase());

    // 1) Score éventuel : garde la meilleure action si une fonction de score est fournie.
    // IMPORTANT : en cas d'égalité (même score), on choisit au hasard.
    // Sinon certains bots deviennent déterministes (ex: toujours "exchange_accept").
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
      const pick = best[Math.floor(Math.random() * best.length)];
      return pick ? [pick] : [];
    }

    // 2) Priorités explicites
    for (const type of prefer) {
      const found = actions.find((a) => a.type?.toLowerCase() === type);
      if (found) return [found];
    }
    for (const type of fallbacks) {
      const found = actions.find((a) => a.type?.toLowerCase() === type);
      if (found) return [found];
    }

    // 3) Sélection aléatoire si rien de spécifique
    const pick = actions[Math.floor(Math.random() * actions.length)];
    return pick ? [pick] : [];
  }

  /**
   * Choix d’action basé sur un profil prédéfini (random, greedy) avec extension possible via opts.
   */
  chooseProfile(
    actions: GameSingleActionDto[],
    ctx: { state: GameStateEntity; playerId: number },
    profile: BotProfile = 'random',
    opts: BotDecisionOptions = {},
  ): GameSingleActionDto[] {
    const scoreFn =
      opts.score ??
      ((action: GameSingleActionDto) => {
        if (profile === 'random') return Math.random();

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
}
