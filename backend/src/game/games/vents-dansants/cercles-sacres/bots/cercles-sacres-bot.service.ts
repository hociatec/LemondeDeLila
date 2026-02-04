import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

@Injectable()
export class CerclesSacresBotService {
  getBotActions(): GameSingleActionDto[] {
    return [];
  }
}
