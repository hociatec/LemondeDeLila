import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

@Injectable()
export class GerardPresidentBotService {
  getBotActions(): GameSingleActionDto[] {
    return [];
  }
}
