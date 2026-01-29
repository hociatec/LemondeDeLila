import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import { TurnStatusService } from '../../../../modules/turn/services/turn-status.service';
import { playingLog } from '../../../../../common/utils/playing-logger';
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
    const isBotTurn = current === botPlayerId;

    const profile = meta.botProfile ?? 'greedy';
    const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
    if (isBotTurn && skip > 0) {
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
    if (available.length === 0) return [];

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
    const players = state.players ?? [];
    const playerById = new Map<number, any>(players.map((p) => [p.id, p]));

    const score = (action: GameSingleActionDto) => {
      const type = action.type?.toLowerCase() ?? '';
      if (type === 'answer_quiz') return 6;
      if (type === 'pick_choice') {
        const index =
          typeof action.payload?.index === 'number' ? action.payload.index : 0;
        // Choix déterministe: on préfère les premiers items pour progresser.
        return 8 - Math.max(0, Math.min(6, index));
      }
      if (type === 'exchange_accept' || type === 'exchange_refuse') {
        const pending = state.pending as any;
        const offer =
          pending && pending.type === 'exchange' && pending.step === 'confirm'
            ? pending
            : null;
        if (!offer || offer.playerId !== botPlayerId) {
          return type === 'exchange_refuse' ? 1 : 0;
        }
        const give = String(offer.give ?? '').trim();
        const take = offer.take != null ? String(offer.take).trim() : null;
        const giveNeeded = give.length > 0 && missing.has(give);
        const takeNeeded = take != null && take.length > 0 && missing.has(take);
        const bonusRequested = offer.bonusRequested === true;

        // Si accepter fait perdre 2 tours (cible sans cartes), on préfère refuser.
        if (bonusRequested) {
          return type === 'exchange_refuse' ? 9 : -10;
        }

        if (type === 'exchange_accept') {
          return 5 + (giveNeeded ? 4 : 0) + (takeNeeded ? -4 : 1);
        }
        return 4 + (takeNeeded ? 3 : 0) + (giveNeeded ? -2 : 0);
      }
      if (type === 'exchange_choose_target') {
        const targetId = action.payload?.targetPlayerId;
        if (typeof targetId !== 'number') return 2;
        const target = playerById.get(targetId);
        const inv = Array.isArray(target?.inventory) ? target.inventory : [];
        const useful = inv.filter((c: any) => missing.has(String(c))).length;
        return 4 + useful * 2 + Math.min(2, inv.length / 3);
      }
      if (type === 'exchange_choose_give') {
        const give = action.payload?.give;
        if (typeof give !== 'string') return 2;
        const cost = missing.has(give) ? -2 : 1;
        return 4 + cost;
      }
      if (type === 'draw') return 7;
      if (type === 'roll') return 1;
      return 0;
    };

    const chosen = this.botRunner.choose(
      available,
      { state, playerId: botPlayerId },
      profile,
      {
        preferTypes: [
          'draw',
          'answer_quiz',
          'pick_choice',
          'exchange_choose_give',
          'exchange_choose_target',
          'roll',
        ],
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
