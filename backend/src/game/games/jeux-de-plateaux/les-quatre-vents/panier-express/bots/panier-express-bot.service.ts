import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { TurnStatusService } from '../../../../../modules/turn/services/turn-status.service';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import * as PanierExpressRulebook from '../rulebook/rulebook';

@Injectable()
export class PanierExpressBotService {
  constructor(
    private readonly botRunner: BotRunnerService,
    private readonly turnStatus: TurnStatusService,
  ) {}

  getBotActions(
    state: GameStateEntity,
    meta: PanierExpressMetadata,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const profile = meta.botProfile ?? 'greedy';
    const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
    if (skip > 0) {
      playingLog('panier.bot.skip', {
        roomId: (state.metadata as any)?.roomId ?? null,
        gameType: (state.metadata as any)?.gameType ?? null,
        userId: botPlayerId,
        type: 'skip_turn',
        botPlayerId,
        skip,
      });
      return [{ type: 'skip_turn', payload: { playerId: botPlayerId } }];
    }

    const available = this.injectQuizAnswer(
      PanierExpressRulebook.getAvailableActions(state, botPlayerId),
      meta,
      botPlayerId,
    );

    const rawPlayer = (state.players ?? []).find((p) => p.id === botPlayerId);
    const shoppingListRaw = rawPlayer?.shoppingList;
    const basketRaw = rawPlayer?.basket;
    const shoppingList = Array.isArray(shoppingListRaw) ? shoppingListRaw : [];
    const basket = Array.isArray(basketRaw) ? basketRaw : [];
    if (!Array.isArray(shoppingListRaw) || !Array.isArray(basketRaw)) {
      playingLog('panier.bot.warn', {
        roomId: (state.metadata as any)?.roomId ?? null,
        gameType: (state.metadata as any)?.gameType ?? null,
        userId: botPlayerId,
        type: 'warn',
        playerId: botPlayerId,
        shoppingListType: typeof shoppingListRaw,
        basketType: typeof basketRaw,
      });
    }
    const missing = new Set(
      shoppingList.filter((item) => !basket.includes(item)),
    );

    const score = (action: GameSingleActionDto) => {
      const type = action.type?.toLowerCase() ?? '';
      if (type === 'answer_quiz') return 6;
      if (type === 'exchange_with') {
        const take = action.payload?.take;
        const give = action.payload?.give;
        const gain = missing.has(take) ? 3 : 0;
        const cost = missing.has(give) ? -2 : 0;
        return 4 + gain + cost;
      }
      if (type === 'roll') return 1;
      return 0;
    };

    const chosen = this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      profile,
      {
        preferTypes: ['answer_quiz', 'exchange_with', 'roll'],
        fallbackTypes: ['roll'],
        score,
      },
    );

    if (chosen.length === 0 && available.length > 0) {
      return [available[0]];
    }
    if (chosen.length) {
      playingLog('panier.bot.actions', {
        roomId: (state.metadata as any)?.roomId ?? null,
        gameType: (state.metadata as any)?.gameType ?? null,
        userId: botPlayerId,
        type: 'bot_actions',
        botPlayerId,
        actions: chosen.map((a) => a.type),
      });
    }
    return chosen;
  }

  private injectQuizAnswer(
    actions: GameSingleActionDto[],
    meta: PanierExpressMetadata,
    playerId: number,
  ): GameSingleActionDto[] {
    if (!Array.isArray(actions)) return [];
    const pending = meta.quiz?.pending?.[playerId];
    const choices = Array.isArray(pending?.choices) ? pending?.choices : [];
    if (!pending || !choices.length) return actions;
    // Déterministe (évite de dépendre de Math.random côté bot).
    const answer = choices[0];
    return actions.map((a) => {
      if (!a || (a.type || '').toLowerCase() !== 'answer_quiz') return a;
      return { ...a, payload: { ...(a.payload ?? {}), answer } };
    });
  }
}
