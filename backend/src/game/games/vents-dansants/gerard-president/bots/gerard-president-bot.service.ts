import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as Rulebook from '../rulebook/rulebook';
import type { GerardPresidentMetadata } from '../model/gerard-president-state.entity';

@Injectable()
export class GerardPresidentBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) {
      return [];
    }

    const meta = (state.metadata ?? {}) as GerardPresidentMetadata;

    if (meta.roundPhase === 'waiting_theme') {
      return [{ type: 'set_theme' }];
    }

    if (meta.roundPhase === 'collecting_names') {
      const specialAction = this.tryPlaySpecial(meta, actions, botPlayerId);
      if (specialAction) {
        return [specialAction];
      }

      const nameAction = this.tryPlayName(meta, actions, botPlayerId);
      if (nameAction) {
        return [nameAction];
      }

      return [{ type: 'pass', payload: {} }];
    }

    if (meta.roundPhase === 'choosing_winner') {
      const chooseAction = this.tryChooseWinner(meta, actions);
      if (chooseAction) {
        return [chooseAction];
      }
    }

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      'random',
    );
  }

  private tryPlaySpecial(
    meta: GerardPresidentMetadata,
    actions: GameSingleActionDto[],
    playerId: number,
  ): GameSingleActionDto | null {
    const candidate = actions.find((action) => action.type === 'play_special');
    if (!candidate) return null;
    const specialHand = meta.specialHands?.[playerId] ?? [];
    if (!specialHand.length) return null;
    return { type: 'play_special', payload: { cardId: specialHand[0] } };
  }

  private tryPlayName(
    meta: GerardPresidentMetadata,
    actions: GameSingleActionDto[],
    playerId: number,
  ): GameSingleActionDto | null {
    const candidate = actions.find((action) => action.type === 'play_name');
    if (!candidate) return null;
    const hand = meta.hands?.[playerId] ?? [];
    if (!hand.length) return null;
    const locked = meta.lockedName;
    const extra = Math.max(0, meta.extraNamesAllowed?.[playerId] ?? 0);
    const limit = 1 + extra;
    const selection: string[] = [];
    for (const name of hand) {
      if (locked && locked === name) {
        continue;
      }
      selection.push(name);
      if (selection.length >= limit) {
        break;
      }
    }
    if (!selection.length) {
      return null;
    }
    return { type: 'play_name', payload: { names: selection } };
  }

  private tryChooseWinner(
    meta: GerardPresidentMetadata,
    actions: GameSingleActionDto[],
  ): GameSingleActionDto | null {
    const candidate = actions.find((action) => action.type === 'choose_winner');
    if (!candidate) return null;
    const submissions = meta.submissions ?? {};
    const ids = Object.keys(submissions)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    if (!ids.length) return null;
    const winnerId = ids[Math.floor(Math.random() * ids.length)];
    return { type: 'choose_winner', payload: { winnerId } };
  }
}
