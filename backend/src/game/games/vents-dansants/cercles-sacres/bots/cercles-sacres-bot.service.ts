import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import * as Rulebook from '../rulebook/rulebook';
import {
  CERCLES_SACRES_CARD_BY_ID,
  type CerclesSacresTheme,
} from '../model/cercles-sacres-cards';
import type { CerclesSacresMetadata } from '../model/cercles-sacres-state.entity';

const CIRCLE_THEMES: ReadonlyArray<CerclesSacresTheme> = [
  'totem',
  'nature',
  'plante',
  'esprit',
  'parole',
  'nation',
];

@Injectable()
export class CerclesSacresBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const actions = Rulebook.getAvailableActions(state, botPlayerId);
    if (!actions.length) return [];

    const circleAction = actions.find(
      (action) => action.type === 'form_circle',
    );
    if (circleAction) {
      const combo = this.buildCircle(state, botPlayerId);
      if (combo.length === CIRCLE_THEMES.length) {
        return [{ type: 'form_circle', payload: { cardIds: combo } }];
      }
    }

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      'greedy',
      {
        preferTypes: ['form_circle', 'discard_card'],
        fallbackTypes: ['discard_card', 'pass'],
      },
    );
  }

  private buildCircle(state: GameStateEntity, playerId: number): string[] {
    const meta = (state.metadata ?? {}) as CerclesSacresMetadata;
    const hand = Array.isArray(meta.hands?.[playerId])
      ? meta.hands[playerId]
      : [];
    const cardsByTheme = new Map<CerclesSacresTheme, string[]>();
    for (const cardId of hand) {
      const definition = CERCLES_SACRES_CARD_BY_ID[cardId];
      if (!definition) continue;
      const list = cardsByTheme.get(definition.theme) ?? [];
      list.push(cardId);
      cardsByTheme.set(definition.theme, list);
    }
    const combo: string[] = [];
    for (const theme of CIRCLE_THEMES) {
      const choices = cardsByTheme.get(theme);
      if (!choices?.length) {
        return [];
      }
      combo.push(choices[Math.floor(Math.random() * choices.length)]);
    }
    return combo;
  }
}
